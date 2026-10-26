<script lang="ts">
  interface Props {
    /** Page name; the home page has none. */
    title?: string;
    description: string;
  }

  const { title, description }: Props = $props();

  const full = $derived(title ? `${title} · Boletix` : "Boletix");
</script>

<svelte:head>
  <title>{full}</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={full} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
</svelte:head>
