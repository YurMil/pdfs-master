import clsx from 'clsx';
import type { DocumentEntity, ExportMode, ExportProfile } from '@/domain/types';

interface ExportDialogProps {
  open: boolean;
  exportMode: ExportMode;
  exportProfile: ExportProfile;
  fileName: string;
  splitRangeInput: string;
  activeDocument?: DocumentEntity;
  selectedCount: number;
  pageCount: number;
  onClose: () => void;
  onFileNameChange: (value: string) => void;
  onModeChange: (mode: ExportMode) => void;
  onSplitRangeChange: (value: string) => void;
  onProfileChange: (profile: ExportProfile) => void;
  onSubmit: () => void;
}

export function ExportDialog({
  open,
  exportMode,
  exportProfile,
  fileName,
  splitRangeInput,
  activeDocument,
  selectedCount,
  pageCount,
  onClose,
  onFileNameChange,
  onModeChange,
  onSplitRangeChange,
  onProfileChange,
  onSubmit,
}: ExportDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[color:var(--pm-overlay)] px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">Export</p>
            <h3 className="mt-2 text-xl font-semibold text-[color:var(--pm-text-strong)]">Build the output package</h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--pm-text-muted)]">
              Choose whether to export the whole workspace, extract the current selection, or split the active
              document into multiple output PDFs.
            </p>
          </div>
          <button type="button" className="m-4 rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid gap-3 border-t border-[color:var(--pm-border-subtle)] px-5 py-4 md:grid-cols-3">
          <ModeCard
            title="Workspace"
            description={`${pageCount} pages in current order`}
            active={exportMode.kind === 'workspace'}
            onClick={() => onModeChange({ kind: 'workspace' })}
          />
          <ModeCard
            title="Selection"
            description={selectedCount ? `${selectedCount} selected pages` : 'No pages selected'}
            active={exportMode.kind === 'selection'}
            disabled={!selectedCount}
            onClick={() => onModeChange({ kind: 'selection', pageIds: activeDocument ? [] : [] })}
          />
          <ModeCard
            title="Split"
            description={activeDocument ? `Split ${activeDocument.name}` : 'Choose an active document first'}
            active={exportMode.kind === 'split'}
            disabled={!activeDocument}
            onClick={() =>
              activeDocument &&
              onModeChange({
                kind: 'split',
                documentId: activeDocument.id,
                rangeGroups: exportMode.kind === 'split' ? exportMode.rangeGroups : [[0]],
              })
            }
          />
        </div>

        <div className="mx-5 space-y-4 rounded-xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface-hover)] p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[color:var(--pm-text-strong)]">File name</span>
            <input
              value={fileName}
              onChange={(event) => onFileNameChange(event.target.value)}
              className="w-full rounded-lg border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-3 py-2.5 text-sm text-[color:var(--pm-text-strong)]"
              placeholder="pdf-master-export"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[color:var(--pm-text-strong)]">Export profile</span>
            <select
              value={exportProfile}
              onChange={(event) => onProfileChange(event.target.value as ExportProfile)}
              className="w-full rounded-lg border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-3 py-2.5 text-sm text-[color:var(--pm-text-strong)]"
            >
              <option value="lossless">Lossless (best quality)</option>
              <option value="low-size">Low size (compressed)</option>
            </select>
            <p className="mt-2 text-xs leading-5 text-[color:var(--pm-text-muted)]">
              Lossless preserves full quality. Low size uses object streams and compression to reduce file size.
            </p>
          </label>

          {exportMode.kind === 'split' ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--pm-text-strong)]">Split ranges</span>
              <input
                value={splitRangeInput}
                onChange={(event) => onSplitRangeChange(event.target.value)}
                className="w-full rounded-lg border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-3 py-2.5 text-sm text-[color:var(--pm-text-strong)]"
                placeholder="1-3;4-6;7-10"
              />
              <p className="mt-2 text-xs leading-5 text-[color:var(--pm-text-muted)]">Use commas inside one output file and semicolons to create separate PDFs. Example: `1-3,5;6-8`.</p>
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--pm-border-subtle)] px-5 py-4">
          <p className="text-sm text-[color:var(--pm-text-muted)]">
            {exportMode.kind === 'workspace' && 'The full workspace order will be exported as one PDF.'}
            {exportMode.kind === 'selection' && 'Only the currently selected pages will be exported.'}
            {exportMode.kind === 'split' && 'Each split group will produce a separate PDF download.'}
          </p>
          <button
            type="button"
            className="rounded-lg bg-[color:var(--pm-accent)] px-4 py-2.5 text-sm font-medium text-[color:var(--pm-on-accent)] hover:bg-[color:var(--pm-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onSubmit}
            disabled={exportMode.kind === 'selection' ? !selectedCount : exportMode.kind === 'split' ? !activeDocument : !pageCount}
          >
            Generate download
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({ title, description, active, disabled, onClick }: { title: string; description: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={clsx(
        'flex min-w-0 flex-col rounded-xl border p-3 text-left transition',
        active ? 'border-[color:var(--pm-selected-bg)] bg-[color:var(--pm-selected-bg)] text-[color:var(--pm-selected-fg)]' : 'border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] text-[color:var(--pm-text-strong)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <p className="w-full font-medium break-all line-clamp-2">{title}</p>
      <p className={clsx('mt-2 break-all', description.length > 40 ? 'text-xs leading-snug' : 'text-sm', active ? 'text-[color:var(--pm-selected-fg)]/85' : 'text-[color:var(--pm-text-muted)]')}>{description}</p>
    </button>
  );
}
