"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Debounce edits and serialize writes so an older response cannot win. */
export function useAutosave<T>({ value, enabled, save, delay = 650 }: {
  value: T;
  enabled: boolean;
  save: (value: T) => Promise<void>;
  delay?: number;
}) {
  const [state, setState] = useState<"saved" | "saving" | "pending" | "error">("saved");
  const [revision, setRevision] = useState(0);
  const saved = useRef(value);
  const failed = useRef<T | undefined>(undefined);
  const busy = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  const reset = useCallback((baseline: T) => {
    saved.current = baseline;
    failed.current = undefined;
    setState("saved");
  }, []);
  const retry = useCallback(() => {
    failed.current = undefined;
    setRevision(n => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || busy.current) return;
    if (Object.is(value, saved.current)) { setState("saved"); return; }
    if (Object.is(value, failed.current)) return;
    setState("pending");
    const timer = setTimeout(async () => {
      busy.current = true;
      setState("saving");
      try {
        await saveRef.current(value);
        saved.current = value;
        failed.current = undefined;
        setState("saved");
      } catch {
        failed.current = value;
        setState("error");
      } finally {
        busy.current = false;
        setRevision(n => n + 1);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [value, enabled, delay, revision]);

  useEffect(() => {
    if (!enabled || (Object.is(value, saved.current) && !busy.current)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [value, enabled, state]);

  return { state, reset, retry };
}
