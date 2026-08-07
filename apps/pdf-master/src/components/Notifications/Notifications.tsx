import type { NotificationModel } from '@/domain/types';

interface NotificationsProps {
  notifications: NotificationModel[];
  onDismiss: (notificationId: string) => void;
}

export function Notifications({ notifications, onDismiss }: NotificationsProps) {
  return (
    // `right-4` with a full-width box pushed the toast off the left edge on a
    // phone; pin it to both edges below sm instead.
    <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col gap-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-full sm:max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="pointer-events-auto rounded-2xl border border-[color:var(--pm-border-subtle)] bg-[color:var(--pm-surface)]/95 p-4 shadow-xl backdrop-blur"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--pm-text-strong)]">{notification.title}</p>
              {notification.description ? <p className="mt-1 text-sm text-[color:var(--pm-text-muted)]">{notification.description}</p> : null}
            </div>
            <button
              type="button"
              className="min-h-9 shrink-0 rounded-full bg-[color:var(--pm-surface-hover)] px-3 py-1 text-xs text-[color:var(--pm-text-muted)] sm:min-h-0 sm:px-2"
              onClick={() => onDismiss(notification.id)}
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
