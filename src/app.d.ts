// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // Augmenting SvelteKit's App namespace needs interface merging; a type alias can't do it.
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Platform {
      env: Env;
      ctx: ExecutionContext;
    }
  }
}

export {};
