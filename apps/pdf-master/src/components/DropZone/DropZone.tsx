import { useRef, useState } from 'react';
import clsx from 'clsx';
import { ACCEPT_IMPORT_TYPES } from '@/services/importImage';

interface DropZoneProps {
  disabled?: boolean;
  compact?: boolean;
  onFiles: (files: File[]) => void;
}

export function DropZone({ disabled, compact, onFiles }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList?.length || disabled) {
      return;
    }
    onFiles(Array.from(fileList));
  };

  return (
    <section className={clsx(
      'mx-auto w-full rounded-[24px] border border-dashed transition',
      compact ? 'max-w-6xl p-3 md:p-4' : 'max-w-5xl p-4 md:p-5',
      isOver ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-accent-soft)]/55 shadow-[0_22px_60px_rgba(37,99,235,0.08)]' : 'border-[color:var(--pm-border)] bg-[color:var(--pm-surface)]',
    )}>
      <div
        className={clsx(
          'mx-auto flex flex-col items-center justify-center rounded-[20px] border border-dashed px-6 text-center transition',
          compact ? 'min-h-[230px] py-10 md:min-h-[250px]' : 'min-h-[280px] py-14',
          isOver ? 'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-surface)]/95' : 'border-[color:var(--pm-border)] bg-[color:var(--pm-surface-hover)]',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsOver(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsOver(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--pm-surface-strong)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--pm-on-surface-strong)] shadow-[0_14px_28px_rgba(15,23,42,0.18)]">
          PDF
        </div>
        <h3 className={clsx('max-w-2xl font-semibold text-[color:var(--pm-text-strong)]', compact ? 'mt-5 text-[1.75rem] leading-[1.15] tracking-[-0.02em]' : 'mt-5 text-[2rem] leading-[1.1] tracking-[-0.03em]')}>
          Drop PDFs or images here
        </h3>
        <p className={clsx('mx-auto mt-3 max-w-2xl text-[color:var(--pm-text-muted)]', compact ? 'text-[15px] leading-7' : 'text-base leading-7')}>
          Import PDFs and images (JPEG, PNG, WebP), keep all processing local, then reorder and export directly from the workspace.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-xl bg-[color:var(--pm-accent)] px-4 py-2.5 text-sm font-semibold text-[color:var(--pm-on-accent)] shadow-[0_14px_28px_rgba(37,99,235,0.18)] hover:bg-[color:var(--pm-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            Select files
          </button>
          <span className="rounded-full border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pm-text-muted)] shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
            Client-side only
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_IMPORT_TYPES}
          multiple
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </section>
  );
}
