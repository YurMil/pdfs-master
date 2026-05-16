import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import clsx from 'clsx';
import { PromiseQueue } from '@/utils/promiseQueue';
import {
  clampRenderScaleToPixelBudget,
  getCanvas2dContextSettings,
  getThumbnailRenderEnvironment,
  resolveViewerDevicePixelRatio,
  resolveViewerRenderConcurrency,
} from '@/utils/thumbnailRendering';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfCanvasViewerProps {
  blob: Blob;
  initialPageNumber: number;
}

interface PageMetrics {
  width: number;
  height: number;
}

const PAGE_GAP_PX = 20;
const PAGE_PADDING_PX = 24;
const PAGE_OVERSCAN = 1;

export function PdfCanvasViewer({ blob, initialPageNumber }: PdfCanvasViewerProps) {
  const environment = useMemo(() => getThumbnailRenderEnvironment(), []);
  const renderQueueRef = useRef(
    new PromiseQueue<void>(resolveViewerRenderConcurrency(environment.hardwareConcurrency)),
  );
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastJumpedPageRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [documentState, setDocumentState] = useState<{
    status: 'loading' | 'ready' | 'error';
    pdfDocument?: PDFDocumentProxy;
    pageMetrics: PageMetrics[];
    error?: string;
  }>({
    status: 'loading',
    pageMetrics: [],
  });
  const [pageWindow, setPageWindow] = useState({ start: 0, end: 0 });
  const [zoomPercent, setZoomPercent] = useState(100);
  const [currentPageNumber, setCurrentPageNumber] = useState(initialPageNumber);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let pdfDocument: PDFDocumentProxy | null = null;

    setDocumentState({ status: 'loading', pageMetrics: [] });

    void blob
      .arrayBuffer()
      .then(async (buffer) => {
        if (cancelled) {
          return;
        }

        loadingTask = pdfjs.getDocument({
          data: new Uint8Array(buffer),
          useWorkerFetch: false,
          isOffscreenCanvasSupported: environment.supportsOffscreenCanvas,
          enableHWA: environment.supportsHardwareAcceleration,
          stopAtErrors: false,
        });

        pdfDocument = await loadingTask.promise;
        const pageMetrics = await Promise.all(
          Array.from({ length: pdfDocument.numPages }, async (_entry, index) => {
            const page = await pdfDocument!.getPage(index + 1);
            const viewport = page.getViewport({ scale: 1 });
            const metrics = {
              width: viewport.width,
              height: viewport.height,
            };
            page.cleanup();
            return metrics;
          }),
        );

        if (cancelled) {
          return;
        }

        setDocumentState({
          status: 'ready',
          pdfDocument,
          pageMetrics,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setDocumentState({
          status: 'error',
          pageMetrics: [],
          error: error instanceof Error ? error.message : 'Viewer could not load this PDF.',
        });
      });

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
      void pdfDocument?.destroy();
    };
  }, [blob, environment.supportsHardwareAcceleration, environment.supportsOffscreenCanvas]);

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const nextWidth = Math.max(0, node.clientWidth || Math.floor(node.getBoundingClientRect().width));
      const nextHeight = Math.max(0, node.clientHeight || Math.floor(node.getBoundingClientRect().height));
      setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
      setContainerHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    measure();
    const frameId = window.requestAnimationFrame(measure);

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) {
        return;
      }
      measure();
    });

    observer.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [documentState.status]);

  const pageLayout = useMemo(() => {
    if (!documentState.pageMetrics.length || containerWidth <= 0) {
      return [];
    }

    const availableWidth = Math.max(160, containerWidth - PAGE_PADDING_PX * 2);
    let top = PAGE_GAP_PX;

    return documentState.pageMetrics.map((metrics) => {
      const fitWidthScale = availableWidth / metrics.width;
      const scale = fitWidthScale * (zoomPercent / 100);
      const width = metrics.width * scale;
      const height = metrics.height * scale;
      const layout = { top, width, height, scale };
      top += height + PAGE_GAP_PX;
      return layout;
    });
  }, [containerWidth, documentState.pageMetrics, zoomPercent]);

  useEffect(() => {
    if (!pageLayout.length) {
      return;
    }

    const updateVisibleRange = () => {
      const node = scrollerRef.current;
      if (!node) {
        return;
      }

      const viewportTop = node.scrollTop;
      const viewportBottom = viewportTop + node.clientHeight;
      let start = 0;
      let end = pageLayout.length - 1;

      for (let index = 0; index < pageLayout.length; index += 1) {
        const pageTop = pageLayout[index]!.top;
        const pageBottom = pageTop + pageLayout[index]!.height;
        if (pageBottom >= viewportTop - PAGE_GAP_PX) {
          start = index;
          break;
        }
      }

      for (let index = start; index < pageLayout.length; index += 1) {
        const pageTop = pageLayout[index]!.top;
        if (pageTop > viewportBottom + PAGE_GAP_PX) {
          end = Math.max(start, index - 1);
          break;
        }
      }

      const overscannedStart = Math.max(0, start - PAGE_OVERSCAN);
      const overscannedEnd = Math.min(pageLayout.length - 1, end + PAGE_OVERSCAN);
      const viewportCenter = viewportTop + node.clientHeight / 2;
      let closestIndex = overscannedStart;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (let index = overscannedStart; index <= overscannedEnd; index += 1) {
        const page = pageLayout[index]!;
        const pageCenter = page.top + page.height / 2;
        const distance = Math.abs(pageCenter - viewportCenter);
        if (distance < closestDistance) {
          closestIndex = index;
          closestDistance = distance;
        }
      }

      startTransition(() => {
        setPageWindow((current) =>
          current.start === overscannedStart && current.end === overscannedEnd
            ? current
            : { start: overscannedStart, end: overscannedEnd },
        );
        setCurrentPageNumber(closestIndex + 1);
      });
    };

    updateVisibleRange();
    const node = scrollerRef.current;
    if (!node) {
      return;
    }

    node.addEventListener('scroll', updateVisibleRange, { passive: true });
    return () => node.removeEventListener('scroll', updateVisibleRange);
  }, [pageLayout]);

  useEffect(() => {
    if (!documentState.pdfDocument || !pageLayout.length) {
      return;
    }

    if (lastJumpedPageRef.current === initialPageNumber) {
      return;
    }

    const targetNode = pageRefs.current[initialPageNumber - 1];
    if (!targetNode) {
      return;
    }

    lastJumpedPageRef.current = initialPageNumber;
    targetNode.scrollIntoView({ block: 'start' });
    setCurrentPageNumber(initialPageNumber);
  }, [documentState.pdfDocument, initialPageNumber, pageLayout]);

  const totalPages = documentState.pageMetrics.length;
  const canZoomOut = zoomPercent > 60;
  const canZoomIn = zoomPercent < 180;
  const contentHeight = pageLayout.length ? pageLayout[pageLayout.length - 1]!.top + pageLayout[pageLayout.length - 1]!.height + PAGE_GAP_PX : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--pm-border-subtle)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-4 py-3">
        <div className="rounded-md border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface-hover)] px-2.5 py-1 text-sm font-medium text-[color:var(--pm-text)]">
          Page {currentPageNumber} / {Math.max(totalPages, 1)}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] p-1">
          <ViewerToolbarButton label="Zoom out" disabled={!canZoomOut} onClick={() => setZoomPercent((current) => Math.max(60, current - 10))}>
            -
          </ViewerToolbarButton>
          <div className="min-w-[64px] text-center text-sm font-medium text-[color:var(--pm-text)]">{zoomPercent}%</div>
          <ViewerToolbarButton label="Zoom in" disabled={!canZoomIn} onClick={() => setZoomPercent((current) => Math.min(180, current + 10))}>
            +
          </ViewerToolbarButton>
        </div>
        <button
          type="button"
          className="rounded-md border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-3 py-1.5 text-sm font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]"
          onClick={() => setZoomPercent(100)}
        >
          Fit width
        </button>
        <span className="text-xs text-[color:var(--pm-text-muted)]">
          Optimized canvas viewer. HWA: {environment.supportsHardwareAcceleration ? 'on' : 'off'} · parallel renders:{' '}
          {resolveViewerRenderConcurrency(environment.hardwareConcurrency)}
        </span>
      </div>

      {documentState.status === 'loading' ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-[color:var(--pm-text-muted)]">Loading PDF pages…</div>
      ) : documentState.status === 'error' ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <h4 className="text-base font-semibold text-[color:var(--pm-text-strong)]">Viewer could not be opened</h4>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--pm-text-muted)]">{documentState.error}</p>
        </div>
      ) : (
        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {pageLayout.length ? (
            <div className="relative mx-auto w-full" style={{ height: `${Math.max(contentHeight, containerHeight)}px` }}>
              {pageLayout.map((layout, index) => {
                const shouldRender = index >= pageWindow.start && index <= pageWindow.end;
                return (
                  <div
                    key={index}
                    ref={(node) => {
                      pageRefs.current[index] = node;
                    }}
                    className="absolute left-1/2"
                    style={{
                      top: `${layout.top}px`,
                      width: `${layout.width}px`,
                      height: `${layout.height}px`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <ViewerPage
                      pdfDocument={documentState.pdfDocument!}
                      pageIndex={index}
                      pageNumber={index + 1}
                      scale={layout.scale}
                      shouldRender={shouldRender}
                      renderQueue={renderQueueRef.current}
                      enableHardwareAcceleration={environment.supportsHardwareAcceleration}
                      className={clsx(
                        currentPageNumber === index + 1 && 'ring-2 ring-[color:var(--pm-accent-strong)] ring-offset-2 ring-offset-[color:var(--pm-border-subtle)]',
                      )}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)]/60 text-sm text-[color:var(--pm-text-muted)]">
              Preparing page layout…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViewerPage({
  pdfDocument,
  pageIndex,
  pageNumber,
  scale,
  shouldRender,
  renderQueue,
  enableHardwareAcceleration,
  className,
}: {
  pdfDocument: PDFDocumentProxy;
  pageIndex: number;
  pageNumber: number;
  scale: number;
  shouldRender: boolean;
  renderQueue: PromiseQueue<void>;
  enableHardwareAcceleration: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle');
  const devicePixelRatio = useMemo(
    () => resolveViewerDevicePixelRatio(typeof window !== 'undefined' ? window.devicePixelRatio : 1),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!shouldRender) {
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      canvas.width = 0;
      canvas.height = 0;
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('rendering');

    void renderQueue
      .add(async () => {
        if (cancelled) {
          return;
        }

        const page = await pdfDocument.getPage(pageIndex + 1);
        if (cancelled) {
          page.cleanup();
          return;
        }

        const cssViewport = page.getViewport({ scale });
        const renderScale = clampRenderScaleToPixelBudget(
          cssViewport.width,
          cssViewport.height,
          devicePixelRatio,
        );
        const renderViewport = page.getViewport({ scale: scale * renderScale });
        const context = canvas.getContext('2d', getCanvas2dContextSettings(enableHardwareAcceleration));

        if (!context) {
          page.cleanup();
          throw new Error('Canvas rendering context is not available for the viewer.');
        }

        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;

        const renderTask = page.render({
          canvas: null,
          canvasContext: context,
          viewport: renderViewport,
          intent: 'display',
        });
        renderTaskRef.current = renderTask;

        try {
          await renderTask.promise;
          if (!cancelled) {
            setStatus('ready');
          }
        } finally {
          renderTaskRef.current = null;
          page.cleanup();
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (error instanceof Error && error.name === 'RenderingCancelledException') {
          return;
        }

        setStatus('error');
      });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [devicePixelRatio, enableHardwareAcceleration, pageIndex, pdfDocument, renderQueue, scale, shouldRender]);

  return (
    <div className={clsx('relative h-full w-full overflow-hidden rounded-xl bg-[color:var(--pm-surface)] shadow-[0_18px_40px_rgba(15,23,42,0.14)]', className)}>
      <canvas ref={canvasRef} className="block h-full w-full bg-[color:var(--pm-surface)]" />
      {status !== 'ready' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[color:var(--pm-surface-hover)] text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">
          {status === 'error' ? `Page ${pageNumber} failed` : `Page ${pageNumber} rendering`}
        </div>
      ) : null}
    </div>
  );
}

function ViewerToolbarButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] text-base font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
