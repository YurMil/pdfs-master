import clsx from 'clsx';
import type {
  DocumentEntity,
  FormFieldModel,
  FormFieldValue,
  ImageImportSettings,
  PaperFormat,
  PaperOrientation,
} from '@/domain/types';
import {
  MARGIN_LABELS,
  MARGIN_OPTIONS_MM,
  PAPER_FORMATS,
  PAPER_FORMAT_LABELS,
  PAPER_ORIENTATIONS,
  PAPER_ORIENTATION_LABELS,
} from '@/domain/paperFormat';
import { countCompletedFields } from '@/services/formService';
import { getMetadataRows } from '@/services/metadataService';

interface InspectorProps {
  document?: DocumentEntity;
  onFieldChange: (fieldName: string, value: FormFieldValue) => void;
  onFlattenToggle: (flatten: boolean) => void;
  onImageFormatChange?: (documentId: string, settings: Partial<ImageImportSettings>) => void;
  imageFormatBusy?: boolean;
}

export function Inspector({
  document,
  onFieldChange,
  onFlattenToggle,
  onImageFormatChange,
  imageFormatBusy,
}: InspectorProps) {
  if (!document) {
    return (
      <div className="flex h-full flex-col bg-[color:var(--pm-panel)]">
        <div className="border-b border-[var(--pm-border)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">Inspector</p>
          <p className="mt-1 text-xs text-[color:var(--pm-text-muted)]">Select a document to review metadata and editable fields.</p>
        </div>
      </div>
    );
  }

  const metadataRows = getMetadataRows(document);
  const completedFields = countCompletedFields(document.formFields);

  return (
    <div className="flex h-full flex-col bg-[color:var(--pm-panel)]">
      <div className="border-b border-[var(--pm-border)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">Inspector</p>
        <h2 className={clsx("mt-1 font-semibold text-[color:var(--pm-text-strong)] break-all", document.name.length > 40 ? "text-xs leading-snug" : "text-sm")}>{document.name}</h2>
        <p className="mt-1 text-xs text-[color:var(--pm-text-muted)]">{document.pageCount} pages · {document.hasForms ? `${completedFields}/${document.formFields.length} fields filled` : 'No form fields detected'}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section className="rounded-xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)]">
          <div className="border-b border-[color:var(--pm-border-subtle)] px-3 py-2.5">
            <h3 className="text-sm font-semibold text-[color:var(--pm-text-strong)]">File info</h3>
          </div>
          <div className="space-y-2 px-3 py-3 text-sm">
            <InfoRow label="Status" value={document.status === 'success' ? 'Ready' : document.status} />
            <InfoRow label="Pages" value={String(document.pageCount)} />
            <InfoRow label="Size" value={formatFileSize(document.sourceFile.size)} />
            <InfoRow label="Forms" value={document.hasForms ? `${document.formFields.length} fields` : 'None'} />
          </div>
        </section>

        <section className="rounded-xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)]">
          <div className="border-b border-[color:var(--pm-border-subtle)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--pm-text-strong)]">Metadata</h3>
              <label className="flex items-center gap-2 text-xs text-[color:var(--pm-text-muted)]">
                <input
                  type="checkbox"
                  checked={document.flattenForms}
                  onChange={(event) => onFlattenToggle(event.target.checked)}
                />
                Flatten on export
              </label>
            </div>
          </div>
          <div className="space-y-2 px-3 py-3 text-sm">
            {metadataRows.map((row) => (
              <InfoRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        {document.kind === 'image' && document.imageFitSettings ? (
          <ImageFormatSection
            documentId={document.id}
            settings={document.imageFitSettings}
            busy={imageFormatBusy}
            onChange={onImageFormatChange}
          />
        ) : null}

        <section className="rounded-xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)]">
          <div className="border-b border-[color:var(--pm-border-subtle)] px-3 py-2.5">
            <h3 className="text-sm font-semibold text-[color:var(--pm-text-strong)]">Form fields</h3>
          </div>
          <div className="space-y-3 px-3 py-3">
            {document.formFields.length ? (
              document.formFields.map((field) => <FormFieldEditor key={field.name} field={field} onChange={onFieldChange} />)
            ) : (
              <p className="text-sm text-[color:var(--pm-text-muted)]">No editable AcroForm fields in this document.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ImageFormatSection({
  documentId,
  settings,
  busy,
  onChange,
}: {
  documentId: string;
  settings: ImageImportSettings;
  busy?: boolean;
  onChange?: (documentId: string, settings: Partial<ImageImportSettings>) => void;
}) {
  return (
    <section className="rounded-xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)]">
      <div className="border-b border-[color:var(--pm-border-subtle)] px-3 py-2.5">
        <h3 className="text-sm font-semibold text-[color:var(--pm-text-strong)]">Image page format</h3>
        <p className="mt-0.5 text-xs text-[color:var(--pm-text-muted)]">
          Fits the source image on a paper-sized page without changing its proportions.
        </p>
      </div>
      <div className="space-y-3 px-3 py-3 text-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--pm-text-muted)]">Paper</span>
          <select
            disabled={busy || !onChange}
            value={settings.paperFormat}
            className="w-full rounded-lg border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm text-[color:var(--pm-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => onChange?.(documentId, { paperFormat: event.target.value as PaperFormat })}
          >
            {PAPER_FORMATS.map((format) => (
              <option key={format} value={format}>
                {PAPER_FORMAT_LABELS[format]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--pm-text-muted)]">Orientation</span>
          <select
            disabled={busy || !onChange}
            value={settings.orientation}
            className="w-full rounded-lg border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm text-[color:var(--pm-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => onChange?.(documentId, { orientation: event.target.value as PaperOrientation })}
          >
            {PAPER_ORIENTATIONS.map((orientation) => (
              <option key={orientation} value={orientation}>
                {PAPER_ORIENTATION_LABELS[orientation]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--pm-text-muted)]">Margin</span>
          <select
            disabled={busy || !onChange}
            value={settings.marginMm}
            className="w-full rounded-lg border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm text-[color:var(--pm-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => onChange?.(documentId, { marginMm: Number(event.target.value) })}
          >
            {MARGIN_OPTIONS_MM.map((mm) => (
              <option key={mm} value={mm}>
                {MARGIN_LABELS[mm]}
              </option>
            ))}
          </select>
        </label>
        {busy ? <p className="text-xs text-[color:var(--pm-text-muted)]">Re-rendering image…</p> : null}
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[color:var(--pm-text-muted)]">{label}</span>
      <span className={clsx("text-right font-medium text-[color:var(--pm-text-strong)] break-all", value.length > 30 ? "text-xs leading-snug" : "text-sm")}>{value}</span>
    </div>
  );
}

function FormFieldEditor({ field, onChange }: { field: FormFieldModel; onChange: (fieldName: string, value: FormFieldValue) => void }) {
  const baseLabel = (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-[color:var(--pm-text-strong)]" htmlFor={field.name}>
        {field.label}
      </label>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pm-text-faint)]">{field.kind}</span>
    </div>
  );

  if (field.kind === 'checkbox') {
    return (
      <div>
        {baseLabel}
        <label className="flex items-center gap-3 rounded-lg border border-[color:var(--pm-border-subtle)] px-3 py-2.5 text-sm text-[color:var(--pm-text)]">
          <input
            id={field.name}
            type="checkbox"
            checked={Boolean(field.value)}
            disabled={field.readOnly}
            onChange={(event) => onChange(field.name, event.target.checked)}
          />
          Checked
        </label>
      </div>
    );
  }

  if (field.kind === 'dropdown') {
    return (
      <div>
        {baseLabel}
        <select
          id={field.name}
          className="w-full rounded-lg border border-[color:var(--pm-border-subtle)] px-3 py-2.5 text-sm text-[color:var(--pm-text-strong)]"
          value={typeof field.value === 'string' ? field.value : ''}
          disabled={field.readOnly}
          onChange={(event) => onChange(field.name, event.target.value)}
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.kind === 'radio') {
    return (
      <div>
        {baseLabel}
        <div className="flex flex-wrap gap-2">
          {field.options?.map((option) => (
            <label key={option} className="flex items-center gap-2 rounded-lg border border-[color:var(--pm-border-subtle)] px-3 py-2 text-sm text-[color:var(--pm-text)]">
              <input
                type="radio"
                name={field.name}
                value={option}
                checked={field.value === option}
                disabled={field.readOnly}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
              {option}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === 'option-list') {
    const selectedValues = Array.isArray(field.value) ? field.value : [];
    return (
      <div>
        {baseLabel}
        <select
          id={field.name}
          multiple
          className="min-h-28 w-full rounded-lg border border-[color:var(--pm-border-subtle)] px-3 py-2.5 text-sm text-[color:var(--pm-text-strong)]"
          value={selectedValues}
          disabled={field.readOnly}
          onChange={(event) =>
            onChange(
              field.name,
              Array.from(event.target.selectedOptions).map((option) => option.value),
            )
          }
        >
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      {baseLabel}
      <input
        id={field.name}
        type="text"
        className="w-full rounded-lg border border-[color:var(--pm-border-subtle)] px-3 py-2.5 text-sm text-[color:var(--pm-text-strong)]"
        value={typeof field.value === 'string' ? field.value : ''}
        disabled={field.readOnly || field.kind === 'unsupported'}
        onChange={(event) => onChange(field.name, event.target.value)}
      />
    </div>
  );
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
