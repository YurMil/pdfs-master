import type { JobState } from '@/domain/types';

interface ProgressBarProps {
  label: string;
  job: JobState;
}

export function ProgressBar({ label, job }: ProgressBarProps) {
  if (!['running', 'queued', 'error', 'success'].includes(job.status)) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)]/95 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[color:var(--pm-text-strong)]">{label}</span>
        <span className="text-[color:var(--pm-text-muted)]">{job.progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--pm-surface-hover)]">
        <div
          className="h-full rounded-full bg-[color:var(--pm-surface-strong)] transition-all duration-300"
          style={{ width: `${Math.max(4, job.progress)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-[color:var(--pm-text-muted)]">{job.message || (job.status === 'success' ? 'Completed.' : 'Working...')}</p>
    </div>
  );
}
