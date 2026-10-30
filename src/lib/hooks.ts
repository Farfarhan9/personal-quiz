import { useCallback, useEffect, useState } from 'react';
import type { ThemeName } from '../types';
import { getSettings, updateSettings } from './storage';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

/** Runs an async loader whenever `key` changes. Ignores results from stale requests. */
export function useAsync<T>(loader: () => Promise<T>, key: string): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loader().then(
      (data) => {
        if (active) setState({ status: 'success', data });
      },
      (err: unknown) => {
        if (active) setState({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) });
      },
    );
    return () => {
      active = false;
    };
    // `loader` is intentionally excluded: callers pass an inline function and `key` captures its inputs.
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

const THEME_COLORS: Record<ThemeName, string> = { light: '#f6f5f1', dark: '#15181d' };

export function applyTheme(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[theme]));
}

export function useTheme(): [ThemeName, () => void] {
  const [theme, setTheme] = useState<ThemeName>(() => getSettings().theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: ThemeName = t === 'dark' ? 'light' : 'dark';
      updateSettings({ theme: next });
      return next;
    });
  }, []);
  return [theme, toggle];
}

/** Sets document.title while the component is mounted. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Quiz Folders` : 'Quiz Folders';
  }, [title]);
}
