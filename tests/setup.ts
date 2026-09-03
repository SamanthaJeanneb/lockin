import '@testing-library/jest-dom/vitest';

// The design system is driven entirely by CSS variables, and jsdom does not
// load stylesheets. Components under test read semantic names, not values, so
// only matchMedia needs stubbing.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
