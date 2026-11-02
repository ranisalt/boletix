<script lang="ts">
  type Props = {
    /** Page name; the home page has none. */
    title?: string;
    description: string;
  };

  const { title, description }: Props = $props();

  const full = $derived(title ? `${title} · Boletix` : "Boletix");
</script>

<svelte:head>
  <title>{full}</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={full} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <!-- Crawlers need an absolute URL, and prerendered pages have no real origin to derive it from. -->
  <meta property="og:image" content="https://boletix.rsa.sh/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Logo do Boletix" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
