import clsx from 'clsx';
import { PdfCanvasViewer } from '@/components/PdfViewerDialog/PdfCanvasViewer';

interface PdfViewerDialogProps {
  open: boolean;
  title: string;
  pageNumber: number;
  pdfBlob?: Blob;
  loading: boolean;
  loadingMessage?: string;
  progress?: number;
  error?: string;
  expanded: boolean;
  onClose: () => void;
  onToggleExpanded: () => void;
  onOpenInBrowser: () => void;
  onDownload: () => void;
}

export function PdfViewerDialog({
  open,
  title,
  pageNumber,
  pdfBlob,
  loading,
  loadingMessage,
  progress,
  error,
  expanded,
  onClose,
  onToggleExpanded,
  onOpenInBrowser,
  onDownload,
}: PdfViewerDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[color:var(--pm-overlay)] p-3 backdrop-blur-sm">
      <div
        className={clsx(
          'flex w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] shadow-2xl',
          expanded ? 'h-[calc(100vh-24px)] max-w-none' : 'h-[min(88vh,920px)] max-w-[min(96vw,1480px)]',
        )}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--pm-border-subtle)] px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">PDF viewer</p>
            <h3 className="truncate text-base font-semibold text-[color:var(--pm-text-strong)]">{title}</h3>
            <p className="mt-1 text-xs text-[color:var(--pm-text-muted)]">
              Page {pageNumber}. The embedded viewer is optimized for smooth canvas rendering and low memory usage. Use "Open in browser" for browser-native search, text selection, annotations, and comments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]"
              onClick={onOpenInBrowser}
              disabled={!pdfBlob || loading}
            >
              Open in browser
            </button>
            <button
              type="button"
              className="rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]"
              onClick={onDownload}
              disabled={!pdfBlob || loading}
            >
              Download
            </button>
            <button
              type="button"
              className="rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]"
              onClick={onToggleExpanded}
            >
              {expanded ? 'Windowed' : 'Expand'}
            </button>
            <button
              type="button"
              className="rounded-lg pm-bg-strong px-3 py-2 text-sm font-medium hover:opacity-90 transition"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--pm-surface-hover)]">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-[color:var(--pm-border-subtle)]">
                <div
                  className="h-full rounded-full bg-[color:var(--pm-accent)] transition-all"
                  style={{ width: `${Math.max(8, progress ?? 12)}%` }}
                />
              </div>
              <p className="mt-4 text-sm font-medium text-[color:var(--pm-text)]">Preparing assembled PDF viewer</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--pm-text-muted)]">{loadingMessage ?? 'Collecting the current workspace order, page transforms, and form values.'}</p>
            </div>
          ) : error ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <h4 className="text-base font-semibold text-[color:var(--pm-text-strong)]">Viewer could not be opened</h4>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--pm-text-muted)]">{error}</p>
          </div>
          ) : pdfBlob ? (
            <PdfCanvasViewer
              key={`${title}:${pageNumber}:${expanded ? 'expanded' : 'windowed'}`}
              blob={pdfBlob}
              initialPageNumber={pageNumber}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
