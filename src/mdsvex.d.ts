// Markdown pages (.svx) compile to ordinary Svelte components.
declare module "*.svx" {
  import type { Component } from "svelte";

  const component: Component;
  export default component;
}
