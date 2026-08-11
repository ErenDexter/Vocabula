<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { lexicon, load, type LexiconEntry } from "../../lib/game/journal";
  import { prettyDate } from "../../lib/game/daily";

  type SortKey = "recent" | "alpha" | "score";

  let entries: LexiconEntry[] = [];
  let ready = false;
  let search = "";
  let sort: SortKey = "recent";
  let bestQuick = 0;
  let bestStreak = 0;

  onMount(() => {
    entries = lexicon();
    const data = load();
    bestQuick = data.bestQuick;
    bestStreak = data.streak.best;
    ready = true;
  });

  $: needle = search.trim().toLowerCase();
  $: filtered = entries
    .filter(
      (e) =>
        needle === "" ||
        e.word.includes(needle) ||
        e.definition.toLowerCase().includes(needle)
    )
    .sort((a, b) => {
      if (sort === "alpha") return a.word.localeCompare(b.word);
      if (sort === "score") return b.best - a.best;
      return b.last.localeCompare(a.last) || a.word.localeCompare(b.word);
    });

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "alpha", label: "A–Z" },
    { key: "score", label: "Score" },
  ];
</script>

<svelte:head>
  <title>My Lexicon — Vocabula</title>
  <meta name="description" content="Every word you have solved in Vocabula." />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:px-10" in:fade>
  <h1 class="text-5xl lg:text-6xl">My Lexicon</h1>

  {#if !ready}
    <p class="mt-4 text-gray-500">Opening your notebook…</p>
  {:else if entries.length === 0}
    <p class="-mt-4 text-xl text-gray-600">
      Nothing here yet. Every word you solve gets written down on this page, with what it
      means and when you learned it.
    </p>
    <div class="mt-6 flex gap-2">
      <a class="paper-btn btn-secondary no-underline" href="/">Play a round</a>
      <a class="paper-btn btn-outline no-underline" href="/daily">Daily Challenge</a>
    </div>
  {:else}
    <div class="-mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-gray-500">
      <span><b class="text-gray-700">{entries.length}</b> words learned</span>
      {#if bestQuick > 0}
        <span
          >best round <b class="text-gray-700">{bestQuick.toLocaleString("en-US")}</b></span
        >
      {/if}
      {#if bestStreak > 0}
        <span>longest streak <b class="text-gray-700">🔥 {bestStreak}</b></span>
      {/if}
    </div>

    <div class="mt-6 flex flex-col gap-3 lg:flex-row lg:items-end">
      <div class="form-group flex-1">
        <label for="lexicon-search">Search</label>
        <input
          id="lexicon-search"
          class="input-block"
          type="search"
          bind:value={search}
          placeholder="a word, or something in its meaning"
        />
      </div>
      <div class="flex gap-1 pb-4">
        {#each SORTS as option}
          <button
            type="button"
            class="btn-small"
            class:btn-secondary={sort === option.key}
            on:click={() => (sort = option.key)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    {#if filtered.length === 0}
      <p class="mt-6 text-gray-500">No matches for “{search}”.</p>
    {:else}
      <div class="mt-2 flex flex-col gap-3">
        {#each filtered as entry (entry.word)}
          <article class="border-2 border-gray-700 bg-white px-4 py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h4 class="text-2xl font-bold uppercase">{entry.word}</h4>
              <div class="flex items-baseline gap-3 text-sm text-gray-500">
                <span class="capitalize">{entry.tier}</span>
                <span class="tabular-nums">{entry.best} pts</span>
                {#if entry.times > 1}
                  <span>×{entry.times}</span>
                {/if}
              </div>
            </div>
            <p class="mt-1 text-base lg:text-lg">{entry.definition}</p>
            <p class="mt-1 text-xs text-gray-400">
              learned {prettyDate(entry.first)}{entry.last !== entry.first
                ? ` · last seen ${prettyDate(entry.last)}`
                : ""}
            </p>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</div>
