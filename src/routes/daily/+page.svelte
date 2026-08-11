<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import type { RoundResult, Word } from "../../lib/types";
  import {
    prettyDate,
    puzzleForDate,
    puzzleNumber,
    todayIso,
  } from "../../lib/game/daily";
  import {
    currentStreak,
    dailyRecord,
    load,
    recordRound,
    type DailyRecord,
  } from "../../lib/game/journal";
  import { copyToClipboard, resultGrid, shareTextFrom } from "../../lib/game/share";
  import Game from "../../components/Game.svelte";
  import FinishScreen from "../../components/FinishScreen.svelte";

  // Resolved on mount, never at prerender: this page is built once and served for
  // days, so baking the build date into the HTML would show a stale puzzle number
  // until hydration caught up.
  let date = "";
  let words: Word[] = [];
  let number = 0;

  let ready = false;
  let started = false;
  let result: RoundResult | null = null;
  let previous: DailyRecord | undefined;
  let streak = 0;
  let bestStreak = 0;
  let copied = false;

  onMount(() => {
    date = todayIso();
    words = puzzleForDate(date);
    number = puzzleNumber(date);
    refresh();
    ready = true;
  });

  function refresh() {
    previous = dailyRecord(date);
    streak = currentStreak(date);
    bestStreak = load().streak.best;
  }

  function onComplete(event: CustomEvent<RoundResult>) {
    result = event.detail;
    recordRound(result, resultGrid(result.words));
    refresh();
  }

  async function copyPrevious() {
    if (!previous) return;
    copied = await copyToClipboard(
      shareTextFrom({
        mode: "daily",
        date,
        grid: previous.grid,
        solved: previous.solved,
        total: previous.total,
        score: previous.score,
        peakCombo: previous.peakCombo ?? 1,
        streak,
      })
    );
    if (copied) setTimeout(() => (copied = false), 2200);
  }
</script>

<svelte:head>
  <title>Daily Challenge — Vocabula</title>
  <meta
    name="description"
    content="Five words, the same for everyone, every day. No account needed."
  />
</svelte:head>

{#if result}
  <FinishScreen {result} {streak} on:again={() => (window.location.href = "/")} />
{:else if started}
  <Game {words} mode="daily" on:complete={onComplete} />
{:else}
  <div class="mt-12 flex justify-center px-4" in:fade>
    <div class="flex w-full max-w-lg flex-col items-center gap-4 text-center">
      <div class="text-sm uppercase tracking-widest text-gray-500">
        {ready ? prettyDate(date) : " "}
      </div>
      <h1 class="text-5xl lg:text-6xl">
        {ready ? `Daily #${number}` : "Daily Challenge"}
      </h1>

      {#if !ready}
        <p class="text-gray-500">Loading today's puzzle…</p>
      {:else if previous}
        <p class="text-xl">You've already played today.</p>

        <div class="w-full border-2 border-gray-700 bg-white px-5 py-5">
          <div class="text-4xl tracking-[0.2em] lg:text-5xl">{previous.grid}</div>
          <div class="mt-3 text-4xl font-bold tabular-nums">
            {previous.score.toLocaleString("en-US")}
            <span class="text-xl font-normal text-gray-500">pts</span>
          </div>
          <div class="mt-2 text-gray-500">
            {previous.solved}/{previous.total} solved · 🔥 {streak} day streak
          </div>
        </div>

        <div class="flex flex-wrap justify-center gap-2">
          <button type="button" class="btn-outline font-bold" on:click={copyPrevious}>
            {copied ? "Copied!" : "Copy result"}
          </button>
          <a class="paper-btn btn-outline no-underline" href="/">Free play</a>
          <a class="paper-btn btn-outline no-underline" href="/lexicon">My Lexicon</a>
        </div>

        <p class="mt-2 text-sm text-gray-500">
          A new puzzle appears at midnight. Longest streak: {bestStreak}.
        </p>
      {:else}
        <p class="text-xl">
          Five words. The same five for everyone, everywhere, today only.
        </p>

        <div class="flex items-center justify-center gap-4 text-gray-500">
          <span>🔥 {streak} day streak</span>
          <span>·</span>
          <span>best {bestStreak}</span>
        </div>

        <button
          type="button"
          class="btn-secondary mt-2 text-xl font-bold"
          on:click={() => (started = true)}
        >
          Start
        </button>

        <p class="mt-2 text-sm text-gray-500">
          Difficulty ramps from common to rare. One attempt.
        </p>
      {/if}
    </div>
  </div>
{/if}
