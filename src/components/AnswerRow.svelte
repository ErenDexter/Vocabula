<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Slot, WordStatus } from "../lib/game/session";

  export let slots: (Slot | null)[];
  export let status: WordStatus;

  const dispatch = createEventDispatcher<{ undo: number }>();

  $: correct = status === "correct";
  $: revealed = status === "revealed";
  $: wrong = status === "wrong";

  /** Long words need tighter type or they wrap on a phone. */
  $: sizeClass = slots.length <= 7 ? "text-4xl" : "text-3xl";
  $: gapClass = slots.length <= 7 ? "gap-x-4" : "gap-x-2";

  function onUndo(index: number) {
    const slot = slots[index];
    if (!slot || slot.locked || status !== "playing") return;
    dispatch("undo", index);
  }
</script>

<div class="relative mt-8 flex justify-center" class:shake={wrong}>
  <div class="flex {gapClass} relative">
    {#each slots as slot, i}
      <button
        type="button"
        on:click={() => onUndo(i)}
        disabled={!slot || slot.locked || status !== "playing"}
        aria-label={slot ? `Remove ${slot.char}` : "Empty space"}
        class="{sizeClass} slot border-b-4 border-gray-700 font-bold leading-tight transition-all duration-300 ease-in-out"
        class:border-green-500={correct}
        class:border-red-500={wrong}
        class:border-gray-400={revealed}
        class:text-gray-500={revealed}
        class:text-transparent={!slot}
        class:cursor-pointer={slot && !slot.locked && status === "playing"}
        class:underline={slot?.locked && !correct && !revealed}
        class:decoration-dotted={slot?.locked}
      >
        {slot ? slot.char : "_"}
      </button>
    {/each}

    {#if correct}
      <svg
        class="pointer-events-none absolute -bottom-3 left-0 h-4 w-full overflow-visible"
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M1,4 C12,1.4 20,5.2 31,3.2 C43,1 52,5.4 63,3.4 C74,1.5 83,5 99,2.6"
          fill="none"
          stroke="currentColor"
          class="scribble text-green-500"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
    {/if}
  </div>
</div>

<style>
  /* Bare glyph slots: PaperCSS would otherwise draw a sketchy box around each one. */
  .slot {
    background: transparent;
    border-top: none;
    border-left: none;
    border-right: none;
    border-radius: 0;
    box-shadow: none;
    margin: 0;
    padding: 0 0.15rem;
    min-width: 1.1ch;
  }
  .slot:hover:not(:disabled),
  .slot:focus {
    background: transparent;
    box-shadow: none;
  }
  .slot:disabled {
    opacity: 1;
    cursor: default;
  }

  .scribble {
    stroke-dasharray: 120;
    stroke-dashoffset: 120;
    animation: draw 0.45s ease-out forwards;
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  .shake {
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }
  @keyframes shake {
    10%, 90% { transform: translateX(-2px); }
    20%, 80% { transform: translateX(4px); }
    30%, 50%, 70% { transform: translateX(-7px); }
    40%, 60% { transform: translateX(7px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .scribble { animation: none; stroke-dashoffset: 0; }
    .shake { animation: none; }
  }
</style>
