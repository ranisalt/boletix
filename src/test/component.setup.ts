import '@testing-library/jest-dom/vitest';

// Node ≥ 25 has its own `localStorage` global that is undefined without --localstorage-file,
// and it shadows jsdom's. Point it back at jsdom's real Storage.
// Server-render specs opt into the node environment, where there is no jsdom.
declare const jsdom: { window: Window } | undefined;
if (typeof jsdom !== 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdom.window.localStorage,
    configurable: true
  });
}
