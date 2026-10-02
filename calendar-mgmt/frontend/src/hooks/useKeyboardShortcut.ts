import { useEffect } from 'react';

export function useKeyboardShortcut(key: string, callback: () => void, enabled = true, modifiers: { alt?: boolean; ctrl?: boolean; shift?: boolean } = { alt: true }) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key.toLowerCase() === key.toLowerCase()) {
        if (modifiers.alt && !e.altKey) return;
        if (modifiers.ctrl && !e.ctrlKey) return;
        if (modifiers.shift && !e.shiftKey) return;
        e.preventDefault();
        callback();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, enabled, modifiers.alt, modifiers.ctrl, modifiers.shift]);
}
