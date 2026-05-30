/// <reference lib="webworker" />
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import { ErrorCode, PdfMasterError, toErrorModel } from '@/domain/errors';
import { getCanvas2dContextSettings, getThumbnailRenderEnvironment } from '@/utils/thumbnailRendering';
import type {
  RenderWorkerCancelRequest,
  RenderWorkerMessage,
  RenderWorkerReleaseDocumentRequest,
  RenderWorkerRequest,
  RenderWorkerResetRequest,
  RenderWorkerResponse,
} from '@/workers/protocols';

interface CachedDocument {
  loadingTask: PDFDocumentLoadingTask;
  document: Promise<PDFDocumentProxy>;
}

interface ActiveRender {
  requestId: string;
  pageId: string;
  renderTask?: RenderTask;
  aborted: boolean;
}

const documentCache = new Map<string, CachedDocument>();
const activeRenders = new Map<string, ActiveRender>();
const renderEnvironment = getThumbnailRenderEnvironment();

self.onmessage = async (event: MessageEvent<RenderWorkerMessage>) => {
  const message = event.data;

  if (message.type === 'render:cancel') {
    cancelRender(message);
    return;
  }

  if (message.type === 'render:release-document') {
    await releaseDocument(message);
    return;
  }

  if (message.type === 'render:reset') {
    await resetWorker(message);
    return;
  }

  await renderThumbnail(message);
};

async function renderThumbnail(message: RenderWorkerRequest): Promise<void> {
  if (!renderEnvironment.supportsOffscreenCanvas) {
    const response: RenderWorkerResponse = {
      type: 'render:unsupported',
      requestId: message.requestId,
      error: {
        code: ErrorCode.UnsupportedOperation,
        message: 'OffscreenCanvas is not available in this worker context.',
        recoverable: true,
      },
    };
    self.postMessage(response);
    return;
  }

  const active: ActiveRender = {
    requestId: message.requestId,
    pageId: message.pageId,
    aborted: false,
  };
  activeRenders.set(message.requestId, active);
  let page: Awaited<ReturnType<PDFDocumentProxy['getPage']>> | null = null;
  let canvas: OffscreenCanvas | null = null;

  try {
    const pdfDocument = await getDocument(message.documentId, message.url);
    if (active.aborted) {
      throw new DOMException('Thumbnail rendering canceled.', 'AbortError');
    }

    page = await pdfDocument.getPage(message.pageIndex + 1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.max(message.maxWidth / baseViewport.width, 0.2);
    const viewport = page.getViewport({ scale });
    canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d', getCanvas2dContextSettings(renderEnvironment.supportsHardwareAcceleration));

    if (!context) {
      throw new PdfMasterError(
        ErrorCode.ThumbnailRenderFailed,
        'OffscreenCanvas 2D rendering context is not available.',
      );
    }

    const renderTask = page.render({
      canvas: null,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    });
    active.renderTask = renderTask;
    await renderTask.promise;

    if (active.aborted) {
      throw new DOMException('Thumbnail rendering canceled.', 'AbortError');
    }

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const response: RenderWorkerResponse = {
      type: 'render:success',
      requestId: message.requestId,
      pageId: message.pageId,
      blob,
      width: canvas.width,
      height: canvas.height,
    };
    self.postMessage(response);
  } catch (error) {
    if (active.aborted) {
      return;
    }

    const response: RenderWorkerResponse = {
      type: 'render:error',
      requestId: message.requestId,
      pageId: message.pageId,
      error: toErrorModel(error, ErrorCode.ThumbnailRenderFailed),
    };
    self.postMessage(response);
  } finally {
    activeRenders.delete(message.requestId);
    page?.cleanup();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

function cancelRender(message: RenderWorkerCancelRequest): void {
  const active = activeRenders.get(message.requestId);
  if (!active) {
    return;
  }

  active.aborted = true;
  active.renderTask?.cancel();
}

async function releaseDocument(message: RenderWorkerReleaseDocumentRequest): Promise<void> {
  const cached = documentCache.get(message.documentId);
  if (!cached) {
    return;
  }

  const document = await cached.document.catch(() => null);
  documentCache.delete(message.documentId);
  cached.loadingTask.destroy();
  await document?.destroy();
}

async function resetWorker(_message: RenderWorkerResetRequest): Promise<void> {
  for (const active of activeRenders.values()) {
    active.aborted = true;
    active.renderTask?.cancel();
  }
  activeRenders.clear();

  const documentIds = [...documentCache.keys()];
  await Promise.all(documentIds.map((documentId) => releaseDocument({ type: 'render:release-document', documentId })));
}

async function getDocument(documentId: string, url: string): Promise<PDFDocumentProxy> {
  const cached = documentCache.get(documentId);
  if (cached) {
    return cached.document;
  }

  const loadingTask = pdfjs.getDocument({
    url: url,
    disableWorker: true,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: renderEnvironment.supportsOffscreenCanvas,
    enableHWA: renderEnvironment.supportsHardwareAcceleration,
    stopAtErrors: false,
  } as Parameters<typeof pdfjs.getDocument>[0] & { disableWorker: boolean });
  const document = loadingTask.promise;
  documentCache.set(documentId, { loadingTask, document });
  return document;
}
