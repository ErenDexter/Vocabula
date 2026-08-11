<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { slide, fade } from "svelte/transition";
  import type { HintKind, RoundMode, RoundResult, Word } from "../lib/types";
  import { createSession, type WordStatus } from "../lib/game/session";
  import { todayIso } from "../lib/game/daily";
  import * as sfx from "../lib/game/sfx";
  import LetterDial from "./LetterDial.svelte";
  import AnswerRow from "./AnswerRow.svelte";
  import HintBar from "./HintBar.svelte";
  import ScoreBar from "./ScoreBar.svelte";
  import PaperCard from "./PaperCard.svelte";

  export let words: Word[];
  export let mode: RoundMode = "quick";

  const dispatch = createEventDispatcher<{ complete: RoundResult }>();
  const session = createSession(words, mode);

  $: state = $session;
  $: isLast = state.index === words.length - 1;
  $: resolved = state.status === "correct" || state.status === "revealed";

  /** Sounds fire on transitions into a status, not on every store update. */
  let previousStatus: WordStatus | null = null;
  let wrongTimer: ReturnType<typeof setTimeout> | null = null;

  $: if (state.status !== previousStatus) {
    const entering = state.status;
    previousStatus = entering;

    if (entering === "correct") sfx.correct();

    if (entering === "wrong") {
      sfx.wrong();
      if (wrongTimer) clearTimeout(wrongTimer);
      // Long enough for the shake to finish before the letters fly home.
      wrongTimer = setTimeout(() => session.clearWrong(), 620);
    }
  }

  let completed = false;
  $: if (state.finished && !completed) {
    completed = true;
    dispatch("complete", session.result(todayIso()));
  }

  onDestroy(() => {
    if (wrongTimer) clearTimeout(wrongTimer);
  });

  function onPlace(event: CustomEvent<number>) {
    sfx.scratch();
    session.place(event.detail);
  }

  function onUndo(event: CustomEvent<number>) {
    sfx.tick();
    session.undoAt(event.detail);
  }

  function onReset() {
    sfx.tick();
    session.reset();
  }

  function onHint(event: CustomEvent<HintKind>) {
    session.useHint(event.detail);
  }

  function advance() {
    if (isLast) session.finish();
    else session.next();
  }

  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (session.handleKey(event)) event.preventDefault();
  }
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="px-4 lg:px-10">
  <ScoreBar
    index={state.index}
    total={words.length}
    score={state.totalScore}
    streak={state.streak}
    tier={state.current.tier}
  />

  <AnswerRow slots={state.slots} status={state.status} on:undo={onUndo} />

  {#if resolved}
    <div class="mt-10" in:slide>
      <PaperCard title={state.target}>
        <p class="text-base lg:text-lg">{state.current.d}</p>
        {#if state.lastBreakdown}
          <p class="text-sm text-gray-500" in:fade>
            +{state.lastBreakdown.subtotal} base
            {#if state.lastBreakdown.multiplier > 1}
              × {state.lastBreakdown.multiplier} combo
            {/if}
            = <span class="font-bold text-gray-700"
              >{state.lastBreakdown.total} pts</span
            >
          </p>
        {:else}
          <p class="text-sm text-gray-500">Skipped — no points this time.</p>
        {/if}
      </PaperCard>
    </div>
  {:else}
    <LetterDial
      dial={state.dial}
      locked={state.status !== "playing"}
      on:place={onPlace}
      on:reset={onReset}
    />

    {#if state.definitionShown}
      <div class="mt-6" in:slide>
        <PaperCard title="DEFINITION" inline>
          <p class="text-sm lg:text-lg">{state.current.d}</p>
        </PaperCard>
      </div>
    {:else if state.hintText}
      <div class="mt-6" in:slide>
        <PaperCard title="HINT:" inline>
          <p class="text-sm lg:text-lg">{state.hintText}</p>
        </PaperCard>
      </div>
    {/if}
  {/if}

  {#if resolved}
    <div class="mb-10 mt-6 flex justify-center gap-2">
      <button type="button" on:click={advance} class="btn-outline font-bold">
        {isLast ? "See results" : "Next >"}
      </button>
    </div>
  {:else}
    <HintBar
      hintsUsed={state.hintsUsed}
      disabled={state.status !== "playing"}
      on:hint={onHint}
      on:skip={session.skip}
    />
    <p class="mb-10 mt-4 hidden text-center text-xs text-gray-400 lg:block">
      Type letters · Backspace to undo · Space to reshuffle · Esc to clear
    </p>
    <div class="mb-10 lg:hidden"></div>
  {/if}
</div>
