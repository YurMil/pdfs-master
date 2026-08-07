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
    // A phone gets a full-bleed sheet rather than a windowed dialog: at 375px the
    // header's button cluster squeezed the title column down to one word per
    // line. Above sm the original centred dialog is unchanged.
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-[color:var(--pm-overlay)] backdrop-blur-sm sm:items-center sm:p-3">
      <div
        className={clsx(
          'flex w-full flex-col overflow-hidden border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] shadow-2xl sm:rounded-2xl sm:border',
          expanded
            ? 'h-full max-w-none sm:h-[calc(100vh-24px)]'
            : 'h-full sm:h-[min(88vh,920px)] sm:max-w-[min(96vw,1480px)]',
        )}
      >
        <div className="flex flex-col gap-2 border-b border-[color:var(--pm-border-subtle)] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-3 sm:flex-1">
            <div className="min-w-0 flex-1">
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)] sm:block">PDF viewer</p>
              <h3 className="truncate text-base font-semibold text-[color:var(--pm-text-strong)]">{title}</h3>
              <p className="mt-1 text-xs text-[color:var(--pm-text-muted)] sm:hidden">Page {pageNumber}</p>
              <p className="mt-1 hidden text-xs text-[color:var(--pm-text-muted)] sm:block">
                Page {pageNumber}. The embedded viewer is optimized for smooth canvas rendering and low memory usage. Use "Open in browser" for browser-native search, text selection, annotations, and comments.
              </p>
            </div>

            {/* Close stays put on a phone; the actions below it scroll. */}
            <button
              type="button"
              aria-label="Close viewer"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] text-[color:var(--pm-text)] sm:hidden"
              onClick={onClose}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.75">
                <path d="M5 5l10 10" />
                <path d="M15 5L5 15" />
              </svg>
            </button>
          </div>

          <div className="pm-scroll-x -mx-4 flex items-center gap-2 px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <button
              type="button"
              className="h-10 shrink-0 whitespace-nowrap rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 text-sm font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)] disabled:opacity-45 sm:h-auto sm:py-2"
              onClick={onOpenInBrowser}
              disabled={!pdfBlob || loading}
            >
              Open in browser
            </button>
            <button
              type="button"
              className="h-10 shrink-0 whitespace-nowrap rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 text-sm font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)] disabled:opacity-45 sm:h-auto sm:py-2"
              onClick={onDownload}
              disabled={!pdfBlob || loading}
            >
              Download
            </button>
            <button
              type="button"
              className="hidden shrink-0 whitespace-nowrap rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)] sm:inline-flex"
              onClick={onToggleExpanded}
            >
              {expanded ? 'Windowed' : 'Expand'}
            </button>
            <button
              type="button"
              className="hidden rounded-lg pm-bg-strong px-3 py-2 text-sm font-medium transition hover:opacity-90 sm:inline-flex"
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
