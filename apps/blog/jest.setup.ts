/**
 * jsdom is missing a handful of APIs the terminal and reader rely on. Stubbing
 * them here keeps the individual tests about behaviour rather than plumbing.
 */

// `useMediaQuery` runs on mount in every client component.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// The reader scrolls a container; jsdom has no layout, so these are no-ops.
Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
  writable: true,
  value: () => undefined,
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: () => undefined,
});

if (typeof window.requestAnimationFrame !== 'function') {
  window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(Date.now()), 0)) as typeof window.requestAnimationFrame;
}

beforeEach(() => {
  window.localStorage.clear();
});
