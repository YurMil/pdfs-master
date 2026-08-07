import type { ReactNode } from 'react';
import clsx from 'clsx';
import type { ImageImportSettings, PaperFormat, PaperOrientation, ThumbnailDensity, ViewMode } from '@/domain/types';
import {
  MARGIN_LABELS,
  MARGIN_OPTIONS_MM,
  PAPER_FORMATS,
  PAPER_FORMAT_LABELS,
  PAPER_ORIENTATIONS,
  PAPER_ORIENTATION_LABELS,
} from '@/domain/paperFormat';

interface ToolbarProps {
  hasWorkspace: boolean;
  importBusy: boolean;
  pageCount: number;
  documentCount: number;
  selectedCount: number;
  activeDocumentName?: string;
  viewMode: ViewMode;
  thumbnailDensity: ThumbnailDensity;
  searchQuery: string;
  documentsPaneCollapsed: boolean;
  inspectorOpen: boolean;
  canSplit: boolean;
  onImport: () => void;
  onExport: () => void;
  onMerge: () => void;
  onSplit: () => void;
  onExtract: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onThumbnailDensityChange: (density: ThumbnailDensity) => void;
  onToggleDocumentsPane: () => void;
  onToggleInspector: () => void;
  onSearchChange: (value: string) => void;
  imageImportSettings: ImageImportSettings;
  onImageImportSettingsChange: (settings: Partial<ImageImportSettings>) => void;
}

const densityOptions: Array<{ value: ThumbnailDensity; label: string }> = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

export function Toolbar({
  hasWorkspace,
  importBusy,
  pageCount,
  documentCount,
  selectedCount,
  activeDocumentName,
  viewMode,
  thumbnailDensity,
  searchQuery,
  documentsPaneCollapsed,
  inspectorOpen,
  canSplit,
  onImport,
  onExport,
  onMerge,
  onSplit,
  onExtract,
  onRotate,
  onDelete,
  onClearSelection,
  onViewModeChange,
  onThumbnailDensityChange,
  onToggleDocumentsPane,
  onToggleInspector,
  onSearchChange,
  imageImportSettings,
  onImageImportSettingsChange,
}: ToolbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--pm-border)] bg-[color:var(--pm-shell)]/95 backdrop-blur-md">
      {/* Below xl the three clusters stack into rows that scroll sideways rather
          than wrapping — wrapping grew the header to ~290px on a 375px phone,
          almost a third of the screen. The xl: classes restore the desktop row. */}
      <div className="flex min-h-14 flex-col gap-2 px-3 py-2 sm:px-4 xl:flex-row xl:flex-wrap xl:items-center">
        <div className="flex items-center gap-3 xl:mr-2 xl:min-w-[220px]">
          <IconButton
            active={!documentsPaneCollapsed}
            label="Documents"
            title="Toggle documents pane"
            onClick={onToggleDocumentsPane}
          >
            <PanelsIcon />
          </IconButton>

          {/* flex-1 pushes the mobile-only inspector button to the right edge;
              on xl the block must stay narrow so the toolbar keeps one row. */}
          <div className="min-w-0 flex-1 xl:flex-none">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-[color:var(--pm-text-strong)]">PDF Master</h1>
              <span className="rounded-md border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">
                Editor
              </span>
            </div>
            <p className="truncate text-xs text-[color:var(--pm-text-muted)]">
              {hasWorkspace
                ? `${documentCount} document${documentCount === 1 ? '' : 's'} · ${pageCount} page${pageCount === 1 ? '' : 's'}${activeDocumentName ? ` · ${activeDocumentName}` : ''}`
                : 'Local PDF workspace'}
            </p>
          </div>

          {/* On desktop the inspector toggle lives at the far right of the row;
              on mobile that row does not exist, so it sits beside the title. */}
          <IconButton
            active={inspectorOpen}
            label="Inspector"
            title="Toggle inspector"
            onClick={onToggleInspector}
            disabled={!hasWorkspace}
            className="xl:hidden"
          >
            <InspectorIcon />
          </IconButton>
        </div>

        <div className="pm-scroll-x -mx-3 flex items-center gap-2 px-3 sm:-mx-4 sm:px-4 xl:mx-0 xl:flex-wrap xl:overflow-visible xl:px-0">
          <PrimaryActionButton label={importBusy ? 'Importing...' : 'Import'} active onClick={onImport} disabled={importBusy} />
          <PrimaryActionButton label="Export" onClick={onExport} disabled={!hasWorkspace} />
          <PrimaryActionButton label="Merge" onClick={onMerge} disabled={!hasWorkspace} />
          <PrimaryActionButton label="Split" onClick={onSplit} disabled={!canSplit} />
          {selectedCount ? <PrimaryActionButton label="Extract" onClick={onExtract} /> : null}
          <ImageFormatPicker
            settings={imageImportSettings}
            onChange={onImageImportSettingsChange}
          />
        </div>

        <div className="flex items-center gap-2 xl:ml-auto xl:flex-1 xl:flex-nowrap xl:justify-end">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 text-sm text-[color:var(--pm-text-muted)] xl:h-9 xl:min-w-[180px] xl:max-w-[240px]">
            <SearchIcon />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              // 16px keeps iOS Safari from zooming the viewport on focus.
              className="w-full min-w-0 border-0 bg-transparent p-0 text-base text-[color:var(--pm-text-strong)] outline-none placeholder:text-[color:var(--pm-text-faint)] xl:text-sm"
              placeholder="Search pages by text, label, or number"
            />
          </label>

          <div className="pm-scroll-x flex items-center gap-2 xl:overflow-visible">
            <SegmentedControl<ViewMode>
              label="View mode"
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
              ]}
              value={viewMode}
              onChange={onViewModeChange}
            />

            <SegmentedControl<ThumbnailDensity>
              label="Thumbnail size"
              options={densityOptions}
              value={thumbnailDensity}
              onChange={onThumbnailDensityChange}
            />

            {selectedCount ? (
              <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-2 py-1.5">
                <span className="whitespace-nowrap px-1 text-xs font-medium text-[color:var(--pm-text-muted)]">{selectedCount} selected</span>
                <IconButton label="Rotate" title="Rotate selected pages" onClick={onRotate}>
                  <RotateIcon />
                </IconButton>
                <IconButton label="Delete" title="Delete selected pages" onClick={onDelete} tone="danger">
                  <DeleteIcon />
                </IconButton>
                <IconButton label="Clear" title="Clear selection" onClick={onClearSelection}>
                  <ClearIcon />
                </IconButton>
              </div>
            ) : null}

            <IconButton
              active={inspectorOpen}
              label="Inspector"
              title="Toggle inspector"
              onClick={onToggleInspector}
              disabled={!hasWorkspace}
              className="hidden xl:inline-flex"
            >
              <InspectorIcon />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Mouse-gesture hints; meaningless on touch and costly in vertical space. */}
      <div className="hidden min-h-8 items-center gap-3 border-t border-[var(--pm-border)] px-3 py-1.5 text-xs text-[color:var(--pm-text-muted)] sm:px-4 xl:flex">
        <span className="font-medium text-[color:var(--pm-text)]">Workspace</span>
        <span>Click to select</span>
        <span>Use the circle icon on a thumbnail to mark exact pages</span>
        <span>Shift-click for range</span>
        <span>Cmd/Ctrl-click to toggle</span>
        {selectedCount ? <span className="text-[color:var(--pm-accent-strong)]">Bulk actions are active in the toolbar</span> : null}
      </div>
    </header>
  );
}

function PrimaryActionButton({
  label,
  onClick,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl border px-3 text-sm font-medium transition xl:h-9',
        active
          ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-accent)] text-[color:var(--pm-on-accent)] shadow-sm'
          : 'border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] text-[color:var(--pm-text)] hover:border-[color:var(--pm-border-strong)] hover:bg-[color:var(--pm-surface-hover)]',
        disabled && 'cursor-not-allowed opacity-45',
      )}
    >
      {label}
    </button>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="pm-segmented-control" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={clsx(
            'pm-segmented-control-btn',
            option.value === value && 'active',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function IconButton({
  children,
  label,
  title,
  onClick,
  active,
  disabled,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition xl:h-8 xl:w-8',
        tone === 'danger'
          ? 'border-[color:var(--pm-danger-border)] bg-[color:var(--pm-danger-surface)] text-[color:var(--pm-danger-text)] hover:bg-[color:var(--pm-danger-surface-hover)]'
          : active
            ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-accent-soft)] text-[color:var(--pm-accent-strong)]'
            : 'border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] text-[color:var(--pm-text-muted)] hover:bg-[color:var(--pm-surface-hover)]',
        disabled && 'cursor-not-allowed opacity-45',
        className,
      )}
    >
      {children}
    </button>
  );
}

function ImageFormatPicker({
  settings,
  onChange,
}: {
  settings: ImageImportSettings;
  onChange: (settings: Partial<ImageImportSettings>) => void;
}) {
  return (
    <div
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-2 text-xs text-[color:var(--pm-text-muted)] xl:h-9"
      title="Default page format applied to imported images. Click an image-derived page in the Inspector to override per file."
    >
      <span className="font-medium uppercase tracking-[0.14em] text-[color:var(--pm-text-muted)]">Image</span>
      <select
        aria-label="Default paper format for imported images"
        className="pm-chip-select rounded-md border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-[color:var(--pm-text-strong)] outline-none focus:ring-1 focus:ring-[color:var(--pm-border-strong)]"
        value={settings.paperFormat}
        onChange={(event) => onChange({ paperFormat: event.target.value as PaperFormat })}
      >
        {PAPER_FORMATS.map((format) => (
          <option key={format} value={format}>
            {PAPER_FORMAT_LABELS[format]}
          </option>
        ))}
      </select>
      <select
        aria-label="Default orientation for imported images"
        className="pm-chip-select rounded-md border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-[color:var(--pm-text-strong)] outline-none focus:ring-1 focus:ring-[color:var(--pm-border-strong)]"
        value={settings.orientation}
        onChange={(event) => onChange({ orientation: event.target.value as PaperOrientation })}
      >
        {PAPER_ORIENTATIONS.map((orientation) => (
          <option key={orientation} value={orientation}>
            {PAPER_ORIENTATION_LABELS[orientation]}
          </option>
        ))}
      </select>
      <span className="ml-1 text-[10px] uppercase tracking-[0.14em] text-[color:var(--pm-text-faint)]">Margin</span>
      <select
        aria-label="Default page margin for imported images"
        className="pm-chip-select rounded-md border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-[color:var(--pm-text-strong)] outline-none focus:ring-1 focus:ring-[color:var(--pm-border-strong)]"
        value={settings.marginMm}
        onChange={(event) => onChange({ marginMm: Number(event.target.value) })}
      >
        {MARGIN_OPTIONS_MM.map((mm) => (
          <option key={mm} value={mm}>
            {MARGIN_LABELS[mm]}
          </option>
        ))}
      </select>
    </div>
  );
}

function PanelsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <rect x="2.5" y="3.5" width="5" height="13" rx="1.5" />
      <rect x="8.5" y="3.5" width="9" height="13" rx="1.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <circle cx="8.5" cy="8.5" r="4.75" />
      <path d="M12 12l4.25 4.25" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M15.5 8.5A5.5 5.5 0 0 0 5.78 6" />
      <path d="M5.5 3.75v3h3" />
      <path d="M4.5 11.5A5.5 5.5 0 0 0 14.22 14" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M4.5 5.5h11" />
      <path d="M7.5 5.5v-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
      <path d="M6.5 7.5l.5 8h6l.5-8" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <path d="M5 5l10 10" />
      <path d="M15 5L5 15" />
    </svg>
  );
}

function InspectorIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.5">
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M8 3.5v13" />
      <path d="M11 7h3" />
      <path d="M11 10h3" />
      <path d="M11 13h2" />
    </svg>
  );
}
