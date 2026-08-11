<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { fade } from "svelte/transition";
  import { toPng } from "html-to-image";
  import type { RoundResult } from "../lib/types";
  import { copyToClipboard, resultGrid, shareText } from "../lib/game/share";
  import { prettyDate, puzzleNumber } from "../lib/game/daily";

  export let result: RoundResult;
  /** Daily streak, shown only for daily rounds. */
  export let streak = 0;
  /** Personal best to beat, shown only for quick rounds. */
  export let best = 0;

  const dispatch = createEventDispatcher<{ again: void }>();

  let card: HTMLElement;
  let copied = false;
  let downloading = false;
  let downloadFailed = false;

  $: grid = resultGrid(result.words);
  $: text = shareText(result, { streak });
  $: solvedWords = result.words.filter((w) => w.solved);
  $: isDaily = result.mode === "daily";
  $: newBest = result.mode === "quick" && result.totalScore >= best && best > 0;

  $: headline =
    result.solvedCount === result.words.length
      ? "Perfect round!"
      : result.solvedCount === 0
        ? "Tomorrow, then."
        : "Nice work!";

  async function copy() {
    copied = await copyToClipboard(text);
    if (copied) setTimeout(() => (copied = false), 2200);
  }

  async function download() {
    downloading = true;
    downloadFailed = false;
    try {
      const url = await toPng(card, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `vocabula-${result.date}.png`;
      link.href = url;
      link.click();
    } catch {
      downloadFailed = true;
    } finally {
      downloading = false;
    }
  }
</script>

<div class="mt-12 flex justify-center px-4" in:fade>
  <div class="flex w-full max-w-xl flex-col items-center gap-5">
    <h2 class="text-4xl lg:text-6xl">{headline}</h2>

    <!-- The shareable card. Also what gets rendered to PNG. -->
    <div
      bind:this={card}
      class="w-full border-2 border-gray-700 bg-white px-5 py-5 text-center"
    >
      <div class="text-sm uppercase tracking-widest text-gray-500">
        {#if isDaily}
          Vocabula #{puzzleNumber(result.date)}
        {:else if result.mode === "warmup"}
          Vocabula warm-up
        {:else}
          Vocabula
        {/if}
        · {prettyDate(result.date)}
      </div>

      <div class="mt-3 text-5xl tracking-[0.2em] lg:text-6xl">{grid}</div>

      <div class="mt-4 text-5xl font-bold tabular-nums lg:text-6xl">
        {result.totalScore.toLocaleString("en-US")}
        <span class="text-2xl font-normal text-gray-500">pts</span>
      </div>

      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <div class="border-2 border-gray-700 px-3 py-1.5">
          <div class="text-xs uppercase text-gray-500">Solved</div>
          <div class="text-2xl font-bold tabular-nums">
            {result.solvedCount}/{result.words.length}
          </div>
        </div>
        <div class="border-2 border-gray-700 px-3 py-1.5">
          <div class="text-xs uppercase text-gray-500">Best combo</div>
          <div class="text-2xl font-bold tabular-nums">×{result.peakCombo}</div>
        </div>
        {#if isDaily}
          <div class="border-2 border-gray-700 px-3 py-1.5">
            <div class="text-xs uppercase text-gray-500">Streak</div>
            <div class="text-2xl font-bold tabular-nums">🔥 {streak}</div>
          </div>
        {:else if best > 0}
          <div class="border-2 border-gray-700 px-3 py-1.5">
            <div class="text-xs uppercase text-gray-500">
              {newBest ? "New best" : "Your best"}
            </div>
            <div class="text-2xl font-bold tabular-nums">
              {Math.max(best, result.totalScore).toLocaleString("en-US")}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div class="flex flex-wrap justify-center gap-2">
      <button type="button" class="btn-outline font-bold" on:click={copy}>
        {copied ? "Copied!" : "Copy result"}
      </button>
      <button
        type="button"
        class="btn-outline"
        class:disabled={downloading}
        disabled={downloading}
        on:click={download}
      >
        {downloading ? "Rendering…" : "Save image"}
      </button>
      <button type="button" class="btn-outline" on:click={() => dispatch("again")}>
        {isDaily ? "Free play" : "Play again"}
      </button>
      <a class="btn-outline paper-btn" href="/lexicon">My Lexicon</a>
    </div>

    {#if downloadFailed}
      <p class="text-sm text-red-500">
        Couldn't render the image here — the copied text works everywhere though.
      </p>
    {/if}

    {#if solvedWords.length > 0}
      <div class="w-full">
        <h4 class="mb-2 text-xl">Words you learned</h4>
        <div class="flex flex-col gap-2">
          {#each solvedWords as word}
            <div class="border-2 border-gray-700 px-3 py-2">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-lg font-bold uppercase">{word.word}</span>
                <span class="shrink-0 text-sm tabular-nums text-gray-500">
                  {word.score} pts
                </span>
              </div>
              <p class="text-sm text-gray-600">{word.definition}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="h-8"></div>
  </div>
</div>
