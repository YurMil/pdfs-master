import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import type { DocumentEntity, DropTargetPosition, PageEntity, ThumbnailDensity, ThumbnailState, ViewMode } from '@/domain/types';

interface PageGridProps {
  groups: Array<{ document: DocumentEntity; pages: PageEntity[] }>;
  activeDocumentId?: string;
  selectedPageIds: string[];
  thumbnails: Record<string, ThumbnailState>;
  viewMode: ViewMode;
  thumbnailDensity: ThumbnailDensity;
  onActivateDocument: (documentId: string) => void;
  onSelectAllInDocument: (documentId: string) => void;
  onPageClick: (pageId: string, gesture?: { additive?: boolean; range?: boolean }) => void;
  onTogglePageSelection: (pageId: string, gesture?: { range?: boolean }) => void;
  onOpenViewer: (pageId: string) => void;
  onRequestThumbnail: (page: PageEntity, document: DocumentEntity) => void;
  onRotatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onReorder: (draggedPageId: string, targetPageId: string, position: DropTargetPosition) => void;
  onExternalFileDrop?: (files: File[], targetPageId: string, position: DropTargetPosition) => void;
  onInvisible?: (pageId: string) => void;
}

const gridDensityClasses: Record<ThumbnailDensity, string> = {
  small: 'grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3',
  medium: 'grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5',
  large: 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4',
};

const previewFrameClasses: Record<ThumbnailDensity, string> = {
  small: 'h-[180px]',
  medium: 'h-[230px]',
  large: 'h-[300px]',
};

/** Returns true when the drag event carries external files from the OS. */
function isExternalFileDrag(event: React.DragEvent): boolean {
  // External files have 'Files' in types but no custom internal drag data
  return event.dataTransfer.types.includes('Files') && !event.dataTransfer.types.includes('text/plain');
}

export function PageGrid({
  groups,
  activeDocumentId,
  selectedPageIds,
  thumbnails,
  viewMode,
  thumbnailDensity,
  onActivateDocument,
  onSelectAllInDocument,
  onPageClick,
  onTogglePageSelection,
  onOpenViewer,
  onRequestThumbnail,
  onRotatePage,
  onDeletePage,
  onReorder,
  onExternalFileDrop,
  onInvisible,
}: PageGridProps) {
  const selected = new Set(selectedPageIds);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [externalDropTarget, setExternalDropTarget] = useState<{ pageId: string; position: DropTargetPosition } | null>(null);

  const handleInternalDragStart = useCallback((pageId: string) => {
    setDraggedPageId(pageId);
  }, []);

  const handleInternalDragEnd = useCallback(() => {
    setDraggedPageId(null);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[color:var(--pm-panel)]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--pm-border)] bg-[color:var(--pm-panel)]/96 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">Workspace</p>
          <p className="mt-1 text-xs text-[color:var(--pm-text-muted)]">Dense page canvas for reordering, inspection, and selection.</p>
        </div>
        <span className="rounded-md border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-2 py-1 text-[11px] font-medium text-[color:var(--pm-text-muted)]">
          {groups.reduce((total, group) => total + group.pages.length, 0)} visible pages
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-6">
          {groups.map(({ document, pages }) => (
            <section key={document.id} className="border-b border-[var(--pm-border)] pb-6 last:border-b-0 last:pb-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="min-w-0 text-left" onClick={() => onActivateDocument(document.id)}>
                  <div className="flex items-center gap-3">
                    <span className={clsx(
                      'h-2.5 w-2.5 rounded-full',
                      activeDocumentId === document.id ? 'bg-[color:var(--pm-accent-strong)]' : 'bg-[color:var(--pm-border)]',
                    )} />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-[color:var(--pm-text-strong)]">{document.name}</h2>
                      <p className="text-xs text-[color:var(--pm-text-muted)]">{pages.length} pages · drag anywhere to reorder</p>
                    </div>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className="rounded-lg border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-2 py-1 text-[11px] font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]"
                    onClick={() => onSelectAllInDocument(document.id)}
                  >
                    Select all
                  </button>
                  <span className="rounded-md bg-[color:var(--pm-surface-hover)] px-2 py-1 text-[11px] font-medium text-[color:var(--pm-text-muted)]">{document.pageCount} total</span>
                </div>
              </div>

              <div className={clsx(viewMode === 'grid' ? `grid ${gridDensityClasses[thumbnailDensity]}` : 'space-y-2')}>
                {pages.map((page) => (
                  <PageCard
                    key={page.id}
                    page={page}
                    document={document}
                    selected={selected.has(page.id)}
                    thumbnail={thumbnails[page.id]}
                    viewMode={viewMode}
                    thumbnailDensity={thumbnailDensity}
                    externalDropPosition={externalDropTarget?.pageId === page.id ? externalDropTarget.position : null}
                    onVisible={() => onRequestThumbnail(page, document)}
                    onInvisible={() => onInvisible?.(page.id)}
                    onClick={onPageClick}
                    onToggleSelection={onTogglePageSelection}
                    onOpenViewer={onOpenViewer}
                    onRotatePage={onRotatePage}
                    onDeletePage={onDeletePage}
                    onDragStart={() => handleInternalDragStart(page.id)}
                    onDragEnd={handleInternalDragEnd}
                    onDrop={(position) => {
                      if (draggedPageId && draggedPageId !== page.id) {
                        onReorder(draggedPageId, page.id, position);
                      }
                    }}
                    onExternalDragOver={(position) => setExternalDropTarget({ pageId: page.id, position })}
                    onExternalDragLeave={() => {
                      setExternalDropTarget((current) =>
                        current?.pageId === page.id ? null : current,
                      );
                    }}
                    onExternalFileDrop={(files, position) => {
                      setExternalDropTarget(null);
                      onExternalFileDrop?.(files, page.id, position);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageCard({
  page,
  document,
  selected,
  thumbnail,
  viewMode,
  thumbnailDensity,
  externalDropPosition,
  onVisible,
  onInvisible,
  onClick,
  onToggleSelection,
  onOpenViewer,
  onRotatePage,
  onDeletePage,
  onDragStart,
  onDragEnd,
  onDrop,
  onExternalDragOver,
  onExternalDragLeave,
  onExternalFileDrop,
}: {
  page: PageEntity;
  document: DocumentEntity;
  selected: boolean;
  thumbnail?: ThumbnailState;
  viewMode: ViewMode;
  thumbnailDensity: ThumbnailDensity;
  externalDropPosition: DropTargetPosition | null;
  onVisible: () => void;
  onInvisible?: () => void;
  onClick: (pageId: string, gesture?: { additive?: boolean; range?: boolean }) => void;
  onToggleSelection: (pageId: string, gesture?: { range?: boolean }) => void;
  onOpenViewer: (pageId: string) => void;
  onRotatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: (position: DropTargetPosition) => void;
  onExternalDragOver: (position: DropTargetPosition) => void;
  onExternalDragLeave: () => void;
  onExternalFileDrop: (files: File[], position: DropTargetPosition) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isList = viewMode === 'list';

  useEffect(() => {
    const node = containerRef.current;
    if (!node || thumbnail?.status === 'ready' || thumbnail?.status === 'error') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          onVisible();
        } else {
          onInvisible?.();
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [thumbnail?.status, onVisible, onInvisible]);

  const computeDropPosition = (event: React.DragEvent): DropTargetPosition => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontal = bounds.width > bounds.height * 1.1;
    const isAfter = horizontal
      ? event.clientX > bounds.left + bounds.width / 2
      : event.clientY > bounds.top + bounds.height / 2;
    return isAfter ? 'after' : 'before';
  };

  return (
    <div className="relative">
      {/* External file drop indicator — before */}
      {externalDropPosition === 'before' ? (
        <div className={clsx(
          'pointer-events-none absolute z-10',
          isList
            ? 'inset-x-0 -top-2 h-1 rounded-full bg-[color:var(--pm-accent)] shadow-[0_0_8px_rgba(37,99,235,0.4)]'
            : '-left-2 inset-y-0 w-1 rounded-full bg-[color:var(--pm-accent)] shadow-[0_0_8px_rgba(37,99,235,0.4)]',
        )} />
      ) : null}

      <div
        ref={containerRef}
        draggable
        className={clsx(
          'group rounded-xl border bg-[color:var(--pm-surface)] transition',
          isList ? 'flex items-center gap-3 p-2.5' : 'p-2.5',
          selected
            ? 'border-[color:var(--pm-accent-strong)] shadow-[0_0_0_1px_rgba(37,99,235,0.12)]'
            : 'border-[color:var(--pm-border-subtle)] hover:border-[color:var(--pm-border)]',
          externalDropPosition && 'ring-2 ring-[color:var(--pm-accent)]/25',
        )}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', 'internal-page-drag');
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          event.preventDefault();
          if (isExternalFileDrag(event)) {
            event.dataTransfer.dropEffect = 'copy';
            const position = computeDropPosition(event);
            onExternalDragOver(position);
          } else {
            event.dataTransfer.dropEffect = 'move';
          }
        }}
        onDragLeave={(event) => {
          // Only fire when leaving the card entirely, not when entering a child
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            onExternalDragLeave();
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const position = computeDropPosition(event);

          if (isExternalFileDrag(event) && event.dataTransfer.files.length) {
            onExternalFileDrop(Array.from(event.dataTransfer.files), position);
            return;
          }

          onDrop(position);
        }}
      >
        <div className={clsx('min-w-0 flex-1', isList && 'flex items-center gap-3')}>
          <div
            role="button"
            tabIndex={0}
            className={clsx(
              'group/preview relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface-hover)]',
              isList ? 'h-28 w-[86px] shrink-0' : previewFrameClasses[thumbnailDensity],
            )}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey) {
                onClick(page.id, {
                  additive: event.metaKey || event.ctrlKey,
                  range: event.shiftKey,
                });
                return;
              }
              onOpenViewer(page.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenViewer(page.id);
              }
            }}
          >
            <ThumbnailPreview thumbnail={thumbnail} rotation={page.rotation} />
            <span className="absolute left-1.5 top-1.5 rounded-md pm-bg-strong px-1.5 py-0.5 text-[10px] font-medium">
              {page.sourcePageIndex + 1}
            </span>
            <button
              type="button"
              aria-label={selected ? 'Remove page from selection' : 'Select page'}
              title={selected ? 'Remove page from selection' : 'Select page'}
              className={clsx(
                'absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition',
                selected
                  ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-accent)] text-[color:var(--pm-on-accent)]'
                  : 'border-[color:var(--pm-border)] bg-[color:var(--pm-surface)]/95 text-[color:var(--pm-text-muted)] hover:border-[color:var(--pm-accent-strong)] hover:text-[color:var(--pm-accent-strong)]',
              )}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelection(page.id, { range: event.shiftKey });
              }}
            >
              <SelectionIcon selected={selected} />
            </button>
            <span className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-[color:var(--pm-overlay)] px-2 py-1 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--pm-on-surface-strong)] opacity-0 transition group-hover/preview:opacity-100">
              Open viewer
            </span>
          </div>

          <button
            type="button"
            className={clsx('min-w-0 w-full text-left', isList ? 'flex-1 pl-0' : 'pt-2.5')}
            onClick={(event) =>
              onClick(page.id, {
                additive: event.metaKey || event.ctrlKey,
                range: event.shiftKey,
              })
            }
          >
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--pm-text-muted)]">{document.name}</p>
            <p className="mt-1 truncate text-sm font-semibold text-[color:var(--pm-text-strong)]">{page.label}</p>
            <p className="mt-1 text-xs text-[color:var(--pm-text-muted)]">Original page {page.sourcePageIndex + 1} · Rotation {page.rotation}°</p>
          </button>
        </div>

        <div className={clsx(
          'flex gap-1.5',
          isList ? 'self-start' : 'mt-2 justify-end',
        )}>
          <PageActionButton label="Rotate page" onClick={() => onRotatePage(page.id)}>
            <RotateIcon />
          </PageActionButton>
          <PageActionButton label="Delete page" tone="danger" onClick={() => onDeletePage(page.id)}>
            <DeleteIcon />
          </PageActionButton>
        </div>
      </div>

      {/* External file drop indicator — after */}
      {externalDropPosition === 'after' ? (
        <div className={clsx(
          'pointer-events-none absolute z-10',
          isList
            ? 'inset-x-0 -bottom-2 h-1 rounded-full bg-[color:var(--pm-accent)] shadow-[0_0_8px_rgba(37,99,235,0.4)]'
            : '-right-2 inset-y-0 w-1 rounded-full bg-[color:var(--pm-accent)] shadow-[0_0_8px_rgba(37,99,235,0.4)]',
        )} />
      ) : null}
    </div>
  );
}

function ThumbnailPreview({ thumbnail, rotation }: { thumbnail?: ThumbnailState; rotation: number }) {
  if (thumbnail?.status === 'ready' && thumbnail.url) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-[color:var(--pm-surface)] p-2">
        <img
          src={thumbnail.url}
          alt="PDF page thumbnail"
          decoding="async"
          draggable={false}
          className="block max-h-full max-w-full object-contain shadow-sm"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </div>
    );
  }

  if (thumbnail?.status === 'error') {
    return <div className="flex h-full w-full items-center justify-center px-3 text-center text-[10px] uppercase tracking-[0.18em] text-[color:var(--pm-danger-text)]">Render failed</div>;
  }

  return <div className="flex h-full w-full items-center justify-center px-3 text-center text-[10px] uppercase tracking-[0.18em] text-[color:var(--pm-text-faint)]">Rendering</div>;
}

function SelectionIcon({ selected }: { selected: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <circle cx="10" cy="10" r="6.25" />
      {selected ? <path d="M6.75 10.1l2.2 2.2 4.4-4.7" /> : null}
    </svg>
  );
}

function PageActionButton({
  children,
  label,
  onClick,
  tone = 'neutral',
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-7 w-7 items-center justify-center rounded-lg border transition',
        tone === 'danger'
          ? 'border-[color:var(--pm-danger-border)] bg-[color:var(--pm-danger-surface)] text-[color:var(--pm-danger-text)] hover:bg-[color:var(--pm-danger-surface-hover)]'
          : 'border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface-hover)] text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5">
      <path d="M15.5 8.5A5.5 5.5 0 0 0 5.78 6" />
      <path d="M5.5 3.75v3h3" />
      <path d="M4.5 11.5A5.5 5.5 0 0 0 14.22 14" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5">
      <path d="M4.5 5.5h11" />
      <path d="M7.5 5.5v-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
      <path d="M6.5 7.5l.5 8h6l.5-8" />
    </svg>
  );
}
