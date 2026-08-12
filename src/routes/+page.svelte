<script lang="ts">
  import { onMount } from "svelte";
  import { fade, slide } from "svelte/transition";
  import type { RoundMode, RoundResult, Tier, Word } from "../lib/types";
  import { MAX_LENGTH, findWord, queryWords } from "../lib/data";
  import { wordsForTopic } from "../lib/net/topics";
  import { systemRandom } from "../lib/game/rng";
  import { todayIso } from "../lib/game/daily";
  import {
    currentStreak,
    hasPlayedDaily,
    load,
    recordRound,
    reviewCandidates,
  } from "../lib/game/journal";
  import { resultGrid } from "../lib/game/share";
  import Game from "../components/Game.svelte";
  import FinishScreen from "../components/FinishScreen.svelte";

  /** Shortest sensible ceiling: below this the pack has too few words to draw from. */
  const MIN_CEILING = 5;
  const TIERS: Tier[] = ["common", "uncommon", "rare"];

  let wordsCount = 10;
  let maxLetters = MAX_LENGTH;
  let customLetterCount = false;
  let customRarity = false;
  let wordsRarity: Tier = "uncommon";
  let customTopic = false;
  let customTopicPrompt = "";

  let loading = false;
  let words: Word[] = [];
  let mode: RoundMode = "quick";
  let started = false;
  let result: RoundResult | null = null;

  let best = 0;
  let streak = 0;
  let dailyDone = false;
  let reviewCount = 0;

  onMount(refreshStats);

  function refreshStats() {
    const today = todayIso();
    best = load().bestQuick;
    streak = currentStreak(today);
    dailyDone = hasPlayedDaily(today);
    reviewCount = reviewCandidates(today).length;
  }

  async function startQuickPlay() {
    loading = true;
    try {
      const options = {
        maxLetters: customLetterCount ? maxLetters : null,
        tier: customRarity && !customTopic ? wordsRarity : null,
      };

      words =
        customTopic && customTopicPrompt.trim() !== ""
          ? await wordsForTopic(customTopicPrompt, wordsCount, systemRandom, options)
          : queryWords({ count: wordsCount, ...options }, systemRandom);

      mode = "quick";
      started = words.length > 0;
    } finally {
      loading = false;
    }
  }

  /** A short review pass over words solved on an earlier day. */
  function startWarmUp() {
    const candidates = reviewCandidates(todayIso()).slice(0, 3);
    words = candidates
      .map((entry) => findWord(entry.word))
      .filter((w): w is Word => w !== undefined);
    if (words.length === 0) return;
    mode = "warmup";
    started = true;
  }

  function onComplete(event: CustomEvent<RoundResult>) {
    result = event.detail;
    recordRound(result, resultGrid(result.words));
    refreshStats();
  }

  function playAgain() {
    result = null;
    started = false;
    words = [];
  }
</script>

<svelte:head>
  <title>Vocabula - learn five new words in five minutes</title>
  <meta
    name="description"
    content="A quick hand-drawn word game. Unscramble words, learn what they mean, and keep a daily streak."
  />
</svelte:head>

{#if result}
  <FinishScreen {result} {best} on:again={playAgain} />
{:else if started}
  <Game {words} {mode} on:complete={onComplete} />
{:else}
  <div class="flex flex-col px-4 lg:mt-16 lg:flex-row lg:gap-16 lg:px-10" transition:fade>
    <div class="lg:ml-10 lg:w-2/5 lg:px-0">
      <h1 class="mt-6 text-5xl lg:text-6xl">
        It will take less than 5 minutes to learn 5 new words!
      </h1>
      <h4 class="mt-6 px-0.5 text-xl lg:text-2xl">
        Expand Your Lexicon: A Quick Vocabulary Boost with Five New Words in Under Five
        Minutes. Elevate Your Language Skills Effortlessly!
      </h4>

      <div class="mt-6 flex flex-col gap-2 lg:mt-8">
        <a href="/daily" class="paper-btn btn-secondary no-underline">
          <span class="font-bold">Daily Challenge</span>
          <span class="ml-2 text-sm">
            {#if dailyDone}
              done today{streak > 0 ? ` · 🔥 ${streak}` : ""}
            {:else if streak > 0}
              keep your 🔥 {streak} streak alive
            {:else}
              five words, same for everyone
            {/if}
          </span>
        </a>

        {#if reviewCount >= 3}
          <button type="button" class="btn-outline text-left" on:click={startWarmUp}>
            <span class="font-bold">Warm up</span>
            <span class="ml-2 text-sm text-gray-500">
              revisit 3 words you already learned
            </span>
          </button>
        {/if}
      </div>
    </div>

    <div class="mb-6 mt-5 flex-1 px-0.5 py-4 lg:mt-0 lg:px-8 lg:py-5">
      <div class="form-group">
        <label class="text-xl font-semibold" for="word-count">You wanna learn:</label>
        <input
          id="word-count"
          bind:value={wordsCount}
          class="input-block"
          type="range"
          min="5"
          max="20"
        />
        <output class="text-md font-semibold">{wordsCount} words</output>
      </div>

      {#if !customTopic}
        <div class="flex flex-col lg:flex-row" transition:slide>
          <div class="flex">
            <div class="mt-5 text-xl font-semibold">Letter Count:</div>
            <div class="form-group ml-2">
              <label for="paperSwitch1" class="paper-switch-tile">
                <input
                  id="paperSwitch1"
                  name="paperSwitch1"
                  type="checkbox"
                  bind:checked={customLetterCount}
                />
                <div class="paper-switch-tile-card border">
                  <div class="paper-switch-tile-card-front border background-warning">
                    Random
                  </div>
                  <div class="paper-switch-tile-card-back border background-secondary">
                    Custom
                  </div>
                </div>
              </label>
            </div>
          </div>
          {#if customLetterCount}
            <div class="form-group -mt-10 flex-1 lg:mt-2">
              <input
                bind:value={maxLetters}
                class="input-block"
                type="range"
                min={MIN_CEILING}
                max={MAX_LENGTH}
                aria-label="Maximum word length"
              />
              <output class="text-md font-semibold">
                up to {maxLetters} letters
              </output>
            </div>
          {/if}
        </div>

        <div
          class="flex flex-col lg:flex-row {customRarity ? 'mb-8 lg:mb-0' : ''} -mt-8
            {customLetterCount ? 'mt-0 lg:-mt-8' : ''}"
          transition:slide
        >
          <div class="flex">
            <div class="mt-5 text-xl font-semibold">Words' Rarity:</div>
            <div class="form-group ml-2">
              <label for="paperSwitch2" class="paper-switch-tile">
                <input
                  id="paperSwitch2"
                  name="paperSwitch2"
                  type="checkbox"
                  bind:checked={customRarity}
                />
                <div class="paper-switch-tile-card border">
                  <div class="paper-switch-tile-card-front border background-warning">
                    Random
                  </div>
                  <div class="paper-switch-tile-card-back border background-secondary">
                    Custom
                  </div>
                </div>
              </label>
            </div>
          </div>
          {#if customRarity}
            <div class="-mt-10 flex flex-1 justify-start lg:-mt-12 lg:gap-x-2">
              {#each TIERS as tier, i}
                <button
                  type="button"
                  on:click={() => (wordsRarity = tier)}
                  class="btn-small font-bold capitalize {i === 0
                    ? 'ml-0'
                    : '-ml-24 lg:ml-0'}"
                  class:btn-secondary={wordsRarity === tier}
                >
                  {tier}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="flex flex-col lg:flex-row{customTopic ? '' : ' -mt-8'}" transition:slide>
        <div class="flex">
          <div class="mt-5 text-xl font-semibold">Topic:</div>
          <div class="form-group ml-2">
            <label for="paperSwitch3" class="paper-switch-tile">
              <input
                id="paperSwitch3"
                name="paperSwitch3"
                type="checkbox"
                bind:checked={customTopic}
              />
              <div class="paper-switch-tile-card border">
                <div class="paper-switch-tile-card-front border background-warning">
                  Random
                </div>
                <div class="paper-switch-tile-card-back border background-secondary">
                  Custom
                </div>
              </div>
            </label>
          </div>
        </div>
        {#if customTopic}
          <div class="form-group -mt-8 flex-1 lg:mt-0">
            <label for="topic-input">Input Topic:</label>
            <textarea
              id="topic-input"
              class="w-full"
              bind:value={customTopicPrompt}
              placeholder="You can write anything. From Shakespear's Hamlet to Naruto."
            ></textarea>
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-3 {customTopic ? '' : ' -mt-8'}">
        {#if best > 0}
          <span class="text-sm text-gray-500">Best: {best.toLocaleString("en-US")}</span>
        {/if}
        <button
          type="button"
          class:disabled={loading}
          class:animate-bounce={loading}
          disabled={loading}
          on:click={startQuickPlay}
          class="font-bold"
        >
          {loading ? "Finding words…" : "Let's Play"}
        </button>
      </div>
    </div>
  </div>
{/if}
