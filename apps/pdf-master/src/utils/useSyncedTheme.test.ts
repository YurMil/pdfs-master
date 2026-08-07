import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSyncedTheme } from './useSyncedTheme';

const flushMicrotasks = async (rounds = 20) => {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
  }
};

describe('useSyncedTheme', () => {
  beforeEach(() => {
    // jsdom ships no matchMedia; the hook only needs the dark-mode query.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  it('does not re-write data-theme in response to its own mutation', async () => {
    const root = document.documentElement;
    const original = root.setAttribute.bind(root);
    let writes = 0;
    // A hard cap keeps a regression from hanging the runner: before the
    // equality guard this loop was unbounded.
    vi.spyOn(root, 'setAttribute').mockImplementation((name: string, value: string) => {
      if (name === 'data-theme') {
        writes += 1;
        if (writes > 50) {
          throw new Error('useSyncedTheme is looping on its own data-theme mutation');
        }
      }
      original(name, value);
    });

    const { unmount } = renderHook(() => useSyncedTheme());

    // The host applying a saved theme is what kicks the observer off in
    // production (the shell writes data-theme once user settings load).
    writes = 0;
    original('data-theme', 'dark');
    await flushMicrotasks();

    expect(writes).toBeLessThanOrEqual(1);
    expect(root.getAttribute('data-theme')).toBe('dark');

    unmount();
  });

  it('applies a theme pushed over postMessage', async () => {
    const root = document.documentElement;
    const { unmount } = renderHook(() => useSyncedTheme());

    root.setAttribute('data-theme', 'light');
    window.dispatchEvent(new MessageEvent('message', { data: { theme: 'dark' } }));
    await flushMicrotasks();

    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);

    unmount();
  });
});
