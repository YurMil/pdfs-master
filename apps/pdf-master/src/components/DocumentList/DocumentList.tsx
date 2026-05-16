import { useState } from 'react';
import clsx from 'clsx';
import type { DocumentEntity, DropTargetPosition } from '@/domain/types';

interface DocumentListProps {
  documents: DocumentEntity[];
  activeDocumentId?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onActivate: (documentId: string) => void;
  onSelectAll: (documentId: string) => void;
  onSplit: (documentId: string) => void;
  onRemove: (documentId: string) => void;
  onReorder: (draggedDocumentId: string, targetDocumentId: string, position: DropTargetPosition) => void;
  onExternalFileDrop?: (files: File[]) => void;
}

/** Returns true when the drag event carries external files from the OS. */
function isExternalFileDrag(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes('Files') && !event.dataTransfer.types.includes('text/plain');
}

export function DocumentList({
  documents,
  activeDocumentId,
  collapsed,
  onToggleCollapse,
  onActivate,
  onSelectAll,
  onSplit,
  onRemove,
  onReorder,
  onExternalFileDrop,
}: DocumentListProps) {
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
  const [externalDragOver, setExternalDragOver] = useState(false);

  return (
    <section
      className={clsx(
        'flex h-full flex-col bg-[color:var(--pm-panel)] transition',
        externalDragOver && 'ring-2 ring-inset ring-[color:var(--pm-accent)]/30',
      )}
      onDragOver={(event) => {
        if (isExternalFileDrag(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setExternalDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setExternalDragOver(false);
        }
      }}
      onDrop={(event) => {
        if (isExternalFileDrag(event) && event.dataTransfer.files.length) {
          event.preventDefault();
          setExternalDragOver(false);
          onExternalFileDrop?.(Array.from(event.dataTransfer.files));
        }
      }}
    >
      <div className={clsx('flex items-center border-b border-[var(--pm-border)]', collapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3')}>
        {collapsed ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] text-[color:var(--pm-text-muted)]"
            onClick={onToggleCollapse}
            title="Expand documents pane"
          >
            <ChevronIcon collapsed={collapsed} />
          </button>
        ) : (
          <>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">Documents</p>
              <p className="mt-1 text-xs text-[color:var(--pm-text-muted)]">Drag to reorder source files</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] text-[color:var(--pm-text-muted)]"
              onClick={onToggleCollapse}
              title="Collapse documents pane"
            >
              <ChevronIcon collapsed={collapsed} />
            </button>
          </>
        )}
      </div>

      <div className={clsx('min-h-0 flex-1 overflow-y-auto', collapsed ? 'space-y-2 px-2 py-3' : 'space-y-2 px-3 py-3')}>
        {documents.length ? (
          documents.map((document) => {
            const isActive = activeDocumentId === document.id;
            return (
              <article
                key={document.id}
                draggable
                title={document.name}
                className={clsx(
                  'group rounded-xl border transition',
                  collapsed ? 'p-1.5' : 'p-3',
                  isActive
                    ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-accent-soft)] shadow-sm'
                    : 'border-transparent bg-[color:var(--pm-surface)] hover:border-[color:var(--pm-border)]',
                )}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', 'internal-document-drag');
                  setDraggedDocumentId(document.id);
                }}
                onDragEnd={() => setDraggedDocumentId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (isExternalFileDrag(event)) {
                    event.dataTransfer.dropEffect = 'copy';
                  } else {
                    event.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  // External file drop on a specific document
                  if (isExternalFileDrag(event) && event.dataTransfer.files.length) {
                    setExternalDragOver(false);
                    onExternalFileDrop?.(Array.from(event.dataTransfer.files));
                    return;
                  }

                  // Internal document reorder
                  if (!draggedDocumentId || draggedDocumentId === document.id) {
                    return;
                  }
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const position: DropTargetPosition = event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before';
                  onReorder(draggedDocumentId, document.id, position);
                  setDraggedDocumentId(null);
                }}
              >
                {collapsed ? (
                  <button
                    type="button"
                    className="flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-center"
                    onClick={() => onActivate(document.id)}
                  >
                    <span className={clsx("flex items-center justify-center rounded-lg bg-[color:var(--pm-surface-strong)] font-semibold text-[color:var(--pm-on-surface-strong)]", document.name.length > 30 ? "h-9 w-9 text-[10px]" : "h-10 w-10 text-xs")}>
                      {getInitials(document.name)}
                    </span>
                    <span className="text-[10px] font-medium text-[color:var(--pm-text-muted)]">{document.pageCount}p</span>
                  </button>
                ) : (
                  <>
                    <button type="button" className="w-full text-left" onClick={() => onActivate(document.id)}>
                      <div className="flex items-start gap-3">
                        <span className={clsx("mt-0.5 flex shrink-0 items-center justify-center rounded-lg bg-[color:var(--pm-surface-strong)] font-semibold text-[color:var(--pm-on-surface-strong)]", document.name.length > 30 ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs")}>
                          {getInitials(document.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className={clsx("font-semibold text-[color:var(--pm-text-strong)] break-all line-clamp-3", document.name.length > 30 ? "text-xs leading-snug" : "text-sm")}>{document.name}</h3>
                              <p className="mt-1 text-xs text-[color:var(--pm-text-muted)]">
                                {document.pageCount} pages · {document.hasForms ? `${document.formFields.length} fields` : 'No forms'}
                              </p>
                            </div>
                            <span className={clsx(
                              'rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                              isActive
                                ? 'bg-[color:var(--pm-accent)] text-[color:var(--pm-on-accent)]'
                                : 'bg-[color:var(--pm-surface-hover)] text-[color:var(--pm-text-muted)]',
                            )}>
                              {document.status === 'success' ? 'Ready' : document.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <MiniAction label="Select all" onClick={() => onSelectAll(document.id)} />
                      <MiniAction label="Split" tone="accent" onClick={() => onSplit(document.id)} />
                      <MiniAction label="Remove" tone="danger" onClick={() => onRemove(document.id)} />
                    </div>
                  </>
                )}
              </article>
            );
          })
        ) : (
          <div className={clsx(
            'rounded-xl border border-dashed text-[color:var(--pm-text-muted)] transition',
            externalDragOver
              ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-accent-soft)]/50'
              : 'border-[color:var(--pm-border)]',
            collapsed ? 'px-2 py-4 text-center text-[10px]' : 'px-3 py-4 text-sm',
          )}>
            {collapsed
              ? externalDragOver ? '+ Drop' : 'No docs'
              : externalDragOver ? 'Drop files here to import' : 'Import PDFs or images — drag files here.'}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniAction({
  label,
  onClick,
  tone = 'neutral',
}: {
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'accent' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={clsx(
        'rounded-lg border px-2 py-1 text-[11px] font-medium transition',
        tone === 'accent'
          ? 'border-[color:var(--pm-accent)]/40 bg-[color:var(--pm-accent-soft)] text-[color:var(--pm-accent-strong)] hover:bg-[color:var(--pm-accent-soft)]'
          : tone === 'danger'
            ? 'border-[color:var(--pm-danger-border)] bg-[color:var(--pm-danger-surface)] text-[color:var(--pm-danger-text)] hover:bg-[color:var(--pm-danger-surface-hover)]'
            : 'border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface-hover)] text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]',
      )}
    >
      {label}
    </button>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      {collapsed ? <path d="M7 4l6 6-6 6" /> : <path d="M13 4l-6 6 6 6" />}
    </svg>
  );
}

function getInitials(name: string): string {
  return name
    .replace(/\.pdf$/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'PDF';
}
