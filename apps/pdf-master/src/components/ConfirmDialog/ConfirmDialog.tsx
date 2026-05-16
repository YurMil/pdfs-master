interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--pm-overlay)] px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)] shadow-2xl">
        <div className="border-b border-[color:var(--pm-border-subtle)] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--pm-text-muted)]">Confirm action</p>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--pm-text-strong)]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--pm-text-muted)]">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button
            type="button"
            className="rounded-lg border border-[color:var(--pm-border)] bg-[color:var(--pm-surface)] px-3 py-2 text-sm font-medium text-[color:var(--pm-text)] hover:bg-[color:var(--pm-surface-hover)]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg border border-[color:var(--pm-danger-border)] bg-[color:var(--pm-danger)] px-3 py-2 text-sm font-medium text-[color:var(--pm-on-accent)] hover:bg-[color:var(--pm-danger)]"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
