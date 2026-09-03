/**
 * The only two places a literal colour is unavoidable, and why.
 *
 *   1. Browser chrome metadata (theme-color) is read by the OS before any
 *      stylesheet loads, so it cannot reference a CSS variable.
 *   2. Email HTML is rendered by clients that strip <style> and do not support
 *      custom properties, so every value must be inline and literal.
 *
 * Both mirror tokens.css exactly. Nothing else in the codebase may hold a hex.
 */
export const CHROME = {
  light: '#ffffff',
  dark: '#0e0e0e',
} as const;

export const EMAIL = {
  canvas: '#ffffff',
  ink: '#171717',
  inkMuted: '#5c5c5c',
  inkSubtle: '#8a8a8a',
  hairline: '#e6e6e6',
} as const;
