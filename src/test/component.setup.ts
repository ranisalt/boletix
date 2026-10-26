import "@testing-library/jest-dom/vitest";

// Node ≥ 25 has its own `localStorage` global that is undefined without --localstorage-file,
// and it shadows jsdom's. Point it back at jsdom's real Storage.
declare const jsdom: { window: Window };
Object.defineProperty(globalThis, "localStorage", {
  value: jsdom.window.localStorage,
  configurable: true,
});
