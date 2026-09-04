'use client';
import { useEffect, useState } from 'react';

/**
 * False while the server renders and on the first client render, true after.
 *
 * Anything read from the clock differs between the two: the server runs in UTC
 * and the reader does not, so `new Date()` produces one date in the HTML and
 * another a moment later in the browser. React treats mismatched text as a
 * corrupted tree — it discards the server markup and re-renders the whole
 * branch, which shows up as React error #418, a flash, and, if someone was
 * mid-sentence in a field, lost input.
 *
 * Gate clock-derived text on this so the first render matches what was sent.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
