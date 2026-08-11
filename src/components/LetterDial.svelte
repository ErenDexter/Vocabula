<script lang="ts">
  import { slide } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  import type { DialLetter } from "../lib/game/session";

  export let dial: DialLetter[];
  /** Disables interaction while the answer is being judged. */
  export let locked = false;

  const dispatch = createEventDispatcher<{ place: number; reset: void }>();

  /** Fraction of the container's half-width at which letters sit. */
  const RADIUS = 0.38;
  /** Fraction of the container's width counted as a hit for drag-to-connect. */
  const HIT = 0.13;

  let size = 0;
  let container: HTMLDivElement;
  let dragging = false;
  let trail: number[] = [];

  /** Unit-circle position for tile `i` of `n`, starting at twelve o'clock. */
  function position(i: number, n: number): { x: number; y: number } {
    const angle = (-90 + (i * 360) / n) * (Math.PI / 180);
    return { x: 0.5 + RADIUS * Math.cos(angle), y: 0.5 + RADIUS * Math.sin(angle) };
  }

  $: positions = dial.map((_, i) => position(i, dial.length));

  /** Letters shrink as the dial fills up so long words still fit on a phone. */
  $: letterSize =
    dial.length <= 5 ? "text-6xl" : dial.length <= 7 ? "text-5xl" : "text-4xl";

  function place(id: number) {
    if (locked) return;
    dispatch("place", id);
  }

  function hitTest(clientX: number, clientY: number): number | null {
    if (!container || size === 0) return null;
    const box = container.getBoundingClientRect();
    const x = (clientX - box.left) / box.width;
    const y = (clientY - box.top) / box.height;
    for (let i = 0; i < positions.length; i++) {
      const dx = x - positions[i].x;
      const dy = y - positions[i].y;
      if (Math.hypot(dx, dy) <= HIT) return i;
    }
    return null;
  }

  function onPointerDown(event: PointerEvent) {
    if (locked) return;
    const index = hitTest(event.clientX, event.clientY);
    if (index === null) return;
    event.preventDefault();
    dragging = true;
    container.setPointerCapture(event.pointerId);
    trail = [index];
    place(dial[index].id);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging || locked) return;
    const index = hitTest(event.clientX, event.clientY);
    if (index === null || trail.includes(index)) return;
    if (dial[index].placed) return;
    trail = [...trail, index];
    place(dial[index].id);
  }

  function endDrag(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    trail = [];
    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: KeyboardEvent, id: number) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    place(id);
  }
</script>

<div
  bind:this={container}
  bind:clientWidth={size}
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={endDrag}
  on:pointercancel={endDrag}
  class="relative mx-auto mt-12 aspect-square w-full max-w-[19rem] touch-none select-none"
  transition:slide
>
  {#if trail.length > 1}
    <svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1">
      <polyline
        points={trail.map((i) => `${positions[i].x},${positions[i].y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        class="text-gray-700 opacity-40"
        stroke-width="0.02"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {/if}

  <button
    type="button"
    on:click={() => dispatch("reset")}
    disabled={locked}
    aria-label="Clear the letters you have placed"
    class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full p-0 px-[7px] text-xl font-extrabold"
    >⟳</button
  >

  {#each dial as letter, i (letter.id)}
    <button
      type="button"
      tabindex={letter.placed ? -1 : 0}
      aria-label={`Letter ${letter.char}`}
      aria-pressed={letter.placed}
      on:keydown={(event) => onKeyDown(event, letter.id)}
      style="left: {positions[i].x * 100}%; top: {positions[i].y * 100}%"
      class="{letterSize} absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0 font-extrabold leading-none shadow-none transition-all duration-300 ease-in-out"
      class:text-gray-400={!letter.placed}
      class:opacity-40={letter.placed}
      class:cursor-default={letter.placed}
    >
      {letter.char}
    </button>
  {/each}
</div>

<style>
  /* PaperCSS styles every <button>; the letter tiles need to stay bare glyphs. */
  button:not([aria-label^="Clear"]) {
    background-color: transparent;
    border: none;
    box-shadow: none;
  }
  button:not([aria-label^="Clear"]):hover,
  button:not([aria-label^="Clear"]):focus {
    background-color: transparent;
    box-shadow: none;
  }
</style>
