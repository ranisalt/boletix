<script lang="ts" module>
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleX from '@lucide/svelte/icons/circle-x';
  import Clock from '@lucide/svelte/icons/clock';
  import Info from '@lucide/svelte/icons/info';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  export type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';

  export const TONE_CLASSES: Record<Tone, string> = {
    success: 'border-success text-success',
    warning: 'border-warning text-warning',
    destructive: 'border-destructive text-destructive',
    info: 'border-primary text-primary',
    neutral: 'border-border text-muted-foreground'
  };

  export const TONE_ICONS = { success: CircleCheck, warning: TriangleAlert, destructive: CircleX, info: Info, neutral: Clock };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    tone: Tone;
    title: string;
    /** 'alert' interrupts screen readers; use it only for problems that block the user. */
    role?: 'status' | 'alert';
    children?: Snippet;
  }

  let { tone, title, role = 'status', children }: Props = $props();

  const id = $props.id();
  const Icon = $derived(TONE_ICONS[tone]);
</script>

<div {role} aria-labelledby={id} data-tone={tone} class="flex gap-3 rounded-lg border-2 bg-card p-4 {TONE_CLASSES[tone]}">
  <Icon class="mt-0.5 size-6 shrink-0" aria-hidden="true" />
  <div class="text-card-foreground">
    <p {id} class="font-semibold">{title}</p>
    {#if children}
      <div class="mt-1 text-sm text-muted-foreground">{@render children()}</div>
    {/if}
  </div>
</div>
