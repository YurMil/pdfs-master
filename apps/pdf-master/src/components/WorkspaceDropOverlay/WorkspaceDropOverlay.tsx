import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface WorkspaceDropOverlayProps {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
}

/**
 * Global overlay that appears when external files are dragged over the window.
 * Does NOT interfere with internal drag-and-drop (page/document reorder).
 */
export function WorkspaceDropOverlay({ disabled, onFiles, children }: WorkspaceDropOverlayProps) {
  const [dragActive, setDragActive] = useState(false);
  const dragCounterRef = useRef(0);

  const isExternalFileDrag = useCallback((event: DragEvent | React.DragEvent) => {
    return event.dataTransfer?.types?.includes('Files') ?? false;
  }, []);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const handleDragEnter = (event: DragEvent) => {
      if (!isExternalFileDrag(event)) {
        return;
      }
      event.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setDragActive(true);
      }
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!isExternalFileDrag(event)) {
        return;
      }
      event.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setDragActive(false);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      if (!isExternalFileDrag(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      setDragActive(false);

      if (event.dataTransfer?.files?.length) {
        onFiles(Array.from(event.dataTransfer.files));
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [disabled, isExternalFileDrag, onFiles]);

  return (
    <div className="relative">
      {children}

      {dragActive ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--pm-overlay)] backdrop-blur-[2px]">
          <div
            className={clsx(
              'pointer-events-none flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-12 py-10',
              'border-[color:var(--pm-accent-strong)] bg-[color:var(--pm-surface)]/95 shadow-[0_32px_80px_rgba(37,99,235,0.12)]',
              'animate-[dropzone-pulse_1.5s_ease-in-out_infinite]',
            )}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--pm-accent)] text-[color:var(--pm-on-accent)] shadow-lg">
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[color:var(--pm-text-strong)]">Drop files to import</p>
              <p className="mt-1 text-sm text-[color:var(--pm-text-muted)]">PDF files and images (JPEG, PNG, WebP, etc.)</p>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes dropzone-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}
