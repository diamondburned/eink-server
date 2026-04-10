<!--
  Inspired by:
  https://github.com/Pictogrammers/svg-icon/blob/master/lib/svg-icon.js
-->

<script lang="ts">
  let {
    class: klass,
    type,
    path,
    size,
  }: {
    class?: string;
    type: "mdi";
    path: string;
    size?: number;
  } = $props();

  const mdi = {
    size: "24px",
    viewbox: "0 0 24 24",
  };
</script>

<svg
  class="icon {klass}"
  xmlns="http://www.w3.org/2000/svg"
  viewBox={mdi.viewbox}
  width={size ?? mdi.size}
  height={size ?? mdi.size}
>
  <path d={path} />
</svg>
