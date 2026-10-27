<script lang="ts">
  import "../app.css";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import type { Path } from "$app/types";
  import House from "@lucide/svelte/icons/house";
  import Info from "@lucide/svelte/icons/info";
  import ListChecks from "@lucide/svelte/icons/list-checks";
  import ScanLine from "@lucide/svelte/icons/scan-line";

  import favicon from "#lib/assets/favicon.svg";
  import { m } from "#lib/paraglide/messages.js";
  import { locales, localizeHref } from "#lib/paraglide/runtime.js";
  import { NoticeBanner, OfficialSources } from "#lib/ui/index.js";

  import type { LayoutProps } from "./$types";

  const { children }: LayoutProps = $props();

  const NAV = [
    { href: resolve("/"), label: m.nav_home, short: m.nav_home, icon: House },
    { href: resolve("/enviar"), label: m.nav_submit, short: m.nav_submit, icon: ScanLine },
    {
      href: resolve("/contribuicoes"),
      label: m.nav_contributions,
      short: m.nav_contributions_short,
      icon: ListChecks,
    },
    { href: resolve("/sobre"), label: m.nav_about, short: m.nav_about, icon: Info },
  ];

  const current = (href: string) => (page.url.pathname === href ? "page" : undefined);
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
  <NoticeBanner />
  <header class="border-b bg-card">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
      <a href={resolve("/")} class="flex items-center gap-2 font-mono text-lg font-semibold">
        <span class="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"
          >B</span
        >Boletix
      </a>
      <nav class="hidden gap-1 md:flex" aria-label={m.nav_label()}>
        {#each NAV as item (item.href)}
          <a
            href={item.href}
            aria-current={current(item.href)}
            class="btn min-h-11 px-3 font-medium text-muted-foreground hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
            >{item.label()}</a
          >
        {/each}
      </nav>
    </div>
  </header>

  <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:py-10">
    {@render children()}
  </main>

  <footer class="border-t bg-muted">
    <div class="mx-auto max-w-5xl space-y-3 px-4 py-6 text-sm">
      <p class="leading-relaxed text-foreground">{m.disclaimer()}</p>
      <OfficialSources class="flex flex-wrap gap-x-4 gap-y-2" />
    </div>
  </footer>

  <nav
    aria-label={m.nav_label()}
    class="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
  >
    {#each NAV as item (item.href)}
      <a
        href={item.href}
        aria-current={current(item.href)}
        class="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground aria-[current=page]:text-primary"
      >
        <item.icon class="size-5" aria-hidden="true" />
        {item.short()}
      </a>
    {/each}
  </nav>
</div>

<div style="display:none">
  {#each locales as locale (locale)}
    <a href={resolve(localizeHref(page.url.pathname, { locale }) as Path)}>{locale}</a>
  {/each}
</div>
