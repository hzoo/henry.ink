import { useEffect, useRef } from "preact/hooks";

type KeyCombo = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
};

type KeyboardShortcut = {
  combo: KeyCombo;
  callback: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const controller = new AbortController();

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const { combo, callback, preventDefault = true } = shortcut;
        const matchesKey = e.code === combo.key;
        const matchesAlt = combo.altKey === undefined || e.altKey === combo.altKey;
        const matchesCtrl = combo.ctrlKey === undefined || e.ctrlKey === combo.ctrlKey;
        const matchesShift = combo.shiftKey === undefined || e.shiftKey === combo.shiftKey;
        const matchesMeta = combo.metaKey === undefined || e.metaKey === combo.metaKey;

        if (matchesKey && matchesAlt && matchesCtrl && matchesShift && matchesMeta) {
          if (preventDefault) {
            e.preventDefault();
          }
          callback(e);
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, { signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [shortcuts]);
} 