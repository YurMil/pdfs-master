import { useEffect } from 'react';

type ThemeMode = 'light' | 'dark';

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark';

const readThemeFromElement = (element: Element | null) => {
  if (!element) return null;
  const value = element.getAttribute('data-theme');
  return isThemeMode(value) ? value : null;
};

const readThemeMessage = (data: unknown) => {
  if (isThemeMode(data)) return data;
  if (!data || typeof data !== 'object') return null;
  const theme = (data as { theme?: unknown }).theme;
  return isThemeMode(theme) ? theme : null;
};

const readHostTheme = () => {
  try {
    if (window.parent !== window) {
      const parentTheme = readThemeFromElement(window.parent.document.documentElement);
      if (parentTheme) return parentTheme;
    }
  } catch {
    return readThemeFromElement(document.documentElement);
  }
  return readThemeFromElement(document.documentElement);
};

export function useSyncedTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (nextTheme: ThemeMode) => {
      root.setAttribute('data-theme', nextTheme);
      root.classList.toggle('dark', nextTheme === 'dark');
      root.style.colorScheme = nextTheme;
    };

    const syncFromHost = () => {
      const hostTheme = readHostTheme();
      if (!hostTheme) return false;
      applyTheme(hostTheme);
      return true;
    };

    const handleMediaChange = () => {
      if (!syncFromHost()) applyTheme(media.matches ? 'dark' : 'light');
    };

    const handleMessage = (event: MessageEvent) => {
      const nextTheme = readThemeMessage(event.data);
      if (nextTheme) applyTheme(nextTheme);
    };

    if (!syncFromHost()) applyTheme(media.matches ? 'dark' : 'light');

    const ownObserver = new MutationObserver(() => {
      syncFromHost();
    });
    ownObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    let parentObserver: MutationObserver | null = null;
    try {
      if (window.parent !== window) {
        parentObserver = new MutationObserver(() => {
          syncFromHost();
        });
        parentObserver.observe(window.parent.document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });
      }
    } catch {
      parentObserver = null;
    }

    media.addEventListener('change', handleMediaChange);
    window.addEventListener('message', handleMessage);

    return () => {
      ownObserver.disconnect();
      parentObserver?.disconnect();
      media.removeEventListener('change', handleMediaChange);
      window.removeEventListener('message', handleMessage);
    };
  }, []);
}
