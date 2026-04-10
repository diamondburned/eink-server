<script lang="ts">
  import { type Snippet } from "svelte";

  interface Props {
    config: {
      width: number;
      height: number;
    };
    children: Snippet;
    enhanceText?: boolean;
  }

  let { config, children, enhanceText = false }: Props = $props();
  let width = $derived.by(() => config.width ?? 800);
  let height = $derived.by(() => config.height ?? 480);
</script>

<div class="wrapper">
  <main
    class="dashboard"
    class:enhance-text={enhanceText}
    style="--width: {width}px; --height: {height}px;"
  >
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
    color: black;
    background: white;
    font-family: "sans-serif";
    font-weight: 400;
    font-size: 11pt;
    overflow: hidden;
    outline: 1px solid black;
    filter: greyscale(1);

    &.enhance-text {
      paint-order: stroke fill;
      -webkit-text-stroke: 0.2px black;
      -webkit-font-smoothing: none;
    }

    width: var(--width);
    min-width: var(--width);

    height: var(--height);
    max-height: var(--height);

    position: relative;
  }

  /* Remove any transitions/animations for e-ink */
  :global(.dashboard *) {
    animation: none;
    transition: none;
    scroll-behavior: auto;
    scrollbar-width: none;
  }
</style>
