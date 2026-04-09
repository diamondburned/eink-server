<script lang="ts">
  import { type Snippet } from "svelte";

  interface Props {
    config: {
      width: number;
      height: number;
    };
    children: Snippet;
  }

  let { config, children }: Props = $props();
  let width = $derived.by(() => config.width ?? 800);
  let height = $derived.by(() => config.height ?? 480);
</script>

<div class="wrapper">
  <main class="dashboard" style="--width: {width}px; --height: {height}px;">
    {@render children()}
  </main>
</div>

<style>
  .wrapper {
    --stripes-width: 10px;
    --stripes-color-1: #c0c0c0;
    --stripes-color-2: #e0e0e0;

    display: flex;
    justify-content: center;
    align-items: center;
    width: 100vw;
    height: 100vh;
    background-color: var(--stripes-color-1);
    background-image: repeating-linear-gradient(
      calc(90deg + 45deg),
      var(--stripes-color-1) 0,
      var(--stripes-color-1) calc(1 * var(--stripes-width)),
      var(--stripes-color-2) calc(1 * var(--stripes-width)),
      var(--stripes-color-2) calc(2 * var(--stripes-width)),
      var(--stripes-color-1) calc(2 * var(--stripes-width))
    );
    padding: 0;
    margin: 0;
    overflow: scroll;
  }

  .dashboard {
    --font-size: 11pt;
    --font-family: "sans-serif";
    --line-height: 1.25;

    color: black;
    background: white;
    font-family: var(--font-family);
    font-weight: var(--font-weight);
    font-size: var(--font-size);
    overflow: hidden;
    outline: 1px solid black;
    paint-order: stroke fill;

    /* Force a text outline on all text for better 1-bit rendering. */
    -webkit-text-stroke: 0.2px black;
    -webkit-font-smoothing: none;

    width: var(--width);
    min-width: var(--width);

    height: var(--height);
    max-height: var(--height);
  }

  /* Remove any transitions/animations for e-ink */
  :global(.dashboard *) {
    animation: none;
    transition: none;
    scroll-behavior: auto;
    scrollbar-width: none;
  }
</style>
