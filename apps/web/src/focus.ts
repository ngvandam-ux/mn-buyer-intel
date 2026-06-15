import { DEFAULT_FOCUS } from '@mn/core';
import { useEffect, useState } from 'react';

/** Global products/tech focus lens, persisted in localStorage + synced across components. */
const KEY = 'mn_focus';
const EVENT = 'mn-focus-changed';

export function getFocus(): string {
  return localStorage.getItem(KEY) ?? DEFAULT_FOCUS;
}

export function setFocus(value: string): void {
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new Event(EVENT));
}

export function useFocus(): [string, (v: string) => void] {
  const [focus, set] = useState(getFocus());
  useEffect(() => {
    const handler = () => set(getFocus());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return [focus, setFocus];
}
