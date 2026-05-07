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
      <div className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
        <div className="mr-2 flex min-w-[220px] items-center gap-3">
          <IconButton
            active={!documentsPaneCollapsed}
            label="Documents"
            title="Toggle documents pane"
            onClick={onToggleDocumentsPane}
          >
            <PanelsIcon />
          </IconButton>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-slate-950">PDF Master</h1>
              <span className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Editor
              </span>
            </div>
            <p className="truncate text-xs text-slate-500">
              {hasWorkspace
                ? `${documentCount} document${documentCount === 1 ? '' : 's'} · ${pageCount} page${pageCount === 1 ? '' : 's'}${activeDocumentName ? ` · ${activeDocumentName}` : ''}`
                : 'Local PDF workspace'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

        <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2 xl:flex-nowrap">
          <label className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-600 xl:max-w-[240px] xl:flex-none">
            <SearchIcon />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Search pages"
            />
          </label>

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
            <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-1.5">
              <span className="px-1 text-xs font-medium text-slate-500">{selectedCount} selected</span>
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
          >
            <InspectorIcon />
          </IconButton>
        </div>
      </div>

      <div className="flex min-h-8 items-center gap-3 border-t border-[var(--pm-border)] px-3 py-1.5 text-xs text-slate-500 sm:px-4">
        <span className="font-medium text-slate-700">Workspace</span>
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
        'inline-flex h-9 items-center rounded-xl border px-3 text-sm font-medium transition',
        active
          ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-accent)] text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
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
    <div className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white p-1" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={clsx(
            'rounded-lg px-2.5 py-1 text-xs font-medium transition',
            option.value === value
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100',
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
}: {
  children: ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
        tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : active
            ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-accent-soft)] text-[color:var(--pm-accent-strong)]'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100',
        disabled && 'cursor-not-allowed opacity-45',
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
      className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 text-xs text-slate-600"
      title="Default page format applied to imported images. Click an image-derived page in the Inspector to override per file."
    >
      <span className="font-medium uppercase tracking-[0.14em] text-slate-500">Image</span>
      <select
        aria-label="Default paper format for imported images"
        className="rounded-md border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
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
        className="rounded-md border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
        value={settings.orientation}
        onChange={(event) => onChange({ orientation: event.target.value as PaperOrientation })}
      >
        {PAPER_ORIENTATIONS.map((orientation) => (
          <option key={orientation} value={orientation}>
            {PAPER_ORIENTATION_LABELS[orientation]}
          </option>
        ))}
      </select>
      <span className="ml-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">Margin</span>
      <select
        aria-label="Default page margin for imported images"
        className="rounded-md border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
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
