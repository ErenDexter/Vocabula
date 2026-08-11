import { writable, get } from "svelte/store";
import type { HintKind, RoundMode, RoundResult, SolvedWord, Word } from "../types";
import { scoreWord, type ScoreBreakdown } from "./scoring";
import { shuffle, systemRandom } from "./rng";

/** One tile on the dial. `id` is stable so duplicate letters stay distinguishable. */
export interface DialLetter {
  id: number;
  char: string;
  placed: boolean;
}

/** One position in the answer row. */
export interface Slot {
  char: string;
  /** Which dial tile filled it. */
  dialId: number;
  /** Placed by a reveal hint, so it can't be undone. */
  locked: boolean;
}

export type WordStatus = "playing" | "correct" | "wrong" | "revealed";

export interface SessionState {
  mode: RoundMode;
  words: Word[];
  index: number;
  current: Word;
  /** Uppercase target. */
  target: string;
  dial: DialLetter[];
  slots: (Slot | null)[];
  status: WordStatus;
  hintsUsed: HintKind[];
  /** The authored hint, shown once the "hint" tier is bought. */
  hintText: string | null;
  /** The definition, shown on a correct answer or once bought. */
  definitionShown: boolean;
  /** Any undo, reset, or wrong answer on this word. */
  dirty: boolean;
  totalScore: number;
  streak: number;
  peakCombo: number;
  results: SolvedWord[];
  lastBreakdown: ScoreBreakdown | null;
  finished: boolean;
}

/** Never produce the target order itself — an unshuffled dial is a non-puzzle. */
function shuffleLetters(target: string, rand: () => number): DialLetter[] {
  const chars = target.split("");
  let order = shuffle(chars, rand);
  if (chars.length > 1) {
    let guard = 0;
    while (order.join("") === target && guard++ < 12) {
      order = shuffle(chars, rand);
    }
    if (order.join("") === target) order.reverse();
  }
  return order.map((char, id) => ({ id, char, placed: false }));
}

function startWord(word: Word, rand: () => number) {
  const target = word.w.toUpperCase();
  return {
    current: word,
    target,
    dial: shuffleLetters(target, rand),
    slots: Array<Slot | null>(target.length).fill(null),
    status: "playing" as WordStatus,
    hintsUsed: [] as HintKind[],
    hintText: null,
    definitionShown: false,
    dirty: false,
    lastBreakdown: null,
  };
}

export function createSession(
  words: Word[],
  mode: RoundMode,
  rand: () => number = systemRandom
) {
  if (words.length === 0) throw new Error("createSession() needs at least one word");

  const store = writable<SessionState>({
    mode,
    words,
    index: 0,
    totalScore: 0,
    streak: 0,
    peakCombo: 0,
    results: [],
    finished: false,
    ...startWord(words[0], rand),
  });

  /** Set on the first interaction with the current word, not when it appears. */
  let firstInteractionAt: number | null = null;
  const now = () => Date.now();

  function touch() {
    if (firstInteractionAt === null) firstInteractionAt = now();
  }

  function elapsed(): number {
    return firstInteractionAt === null ? 0 : now() - firstInteractionAt;
  }

  /** Runs after every slot change: locks in a correct word or flags a wrong one. */
  function evaluate(s: SessionState): SessionState {
    if (s.slots.some((slot) => slot === null)) return s;

    const attempt = s.slots.map((slot) => slot!.char).join("");
    if (attempt !== s.target) {
      return { ...s, status: "wrong", dirty: true, streak: 0 };
    }

    const streak = s.streak + 1;
    const breakdown = scoreWord({
      length: s.target.length,
      elapsedMs: elapsed(),
      hintsUsed: s.hintsUsed,
      clean: !s.dirty,
      streak,
    });

    const solved: SolvedWord = {
      word: s.current.w,
      definition: s.current.d,
      tier: s.current.tier,
      score: breakdown.total,
      elapsedMs: elapsed(),
      hintsUsed: [...s.hintsUsed],
      clean: !s.dirty,
      solved: true,
    };

    return {
      ...s,
      status: "correct",
      definitionShown: true,
      streak,
      peakCombo: Math.max(s.peakCombo, streak),
      totalScore: s.totalScore + breakdown.total,
      lastBreakdown: breakdown,
      results: [...s.results, solved],
    };
  }

  /** Place a specific dial tile into the next empty slot. */
  function place(dialId: number) {
    touch();
    store.update((s) => {
      if (s.status !== "playing") return s;
      const tile = s.dial.find((d) => d.id === dialId);
      if (!tile || tile.placed) return s;

      const target = s.slots.findIndex((slot) => slot === null);
      if (target === -1) return s;

      const slots = s.slots.slice();
      slots[target] = { char: tile.char, dialId: tile.id, locked: false };
      const dial = s.dial.map((d) => (d.id === dialId ? { ...d, placed: true } : d));
      return evaluate({ ...s, dial, slots });
    });
  }

  /** Type a character: fills using the first unplaced tile bearing that letter. */
  function typeLetter(char: string) {
    const upper = char.toUpperCase();
    const s = get(store);
    if (s.status !== "playing") return;
    const tile = s.dial.find((d) => !d.placed && d.char === upper);
    if (tile) place(tile.id);
  }

  /** Return the letter in a given slot to the dial. Locked (revealed) slots resist. */
  function undoAt(slotIndex: number) {
    store.update((s) => {
      if (s.status !== "playing") return s;
      const slot = s.slots[slotIndex];
      if (!slot || slot.locked) return s;

      const slots = s.slots.slice();
      slots[slotIndex] = null;
      const dial = s.dial.map((d) =>
        d.id === slot.dialId ? { ...d, placed: false } : d
      );
      return { ...s, dial, slots, dirty: true };
    });
  }

  /** Backspace: remove the last unlocked letter placed. */
  function undo() {
    const s = get(store);
    for (let i = s.slots.length - 1; i >= 0; i--) {
      const slot = s.slots[i];
      if (slot && !slot.locked) {
        undoAt(i);
        return;
      }
    }
  }

  /** Clear every unlocked slot. Used by the reset button and after a wrong answer. */
  function clearSlots(markDirty: boolean) {
    store.update((s) => {
      const slots = s.slots.map((slot) => (slot?.locked ? slot : null));
      const keptIds = new Set(
        slots.filter((slot): slot is Slot => slot !== null).map((slot) => slot.dialId)
      );
      const dial = s.dial.map((d) => ({ ...d, placed: keptIds.has(d.id) }));
      return {
        ...s,
        dial,
        slots,
        status: "playing",
        dirty: s.dirty || markDirty,
      };
    });
  }

  /** Called by the view once the shake animation has run. */
  function clearWrong() {
    clearSlots(true);
  }

  function reset() {
    touch();
    clearSlots(true);
  }

  /** Reshuffle the dial without disturbing what's already placed. */
  function reshuffle() {
    store.update((s) => {
      if (s.status !== "playing") return s;
      const chars = shuffle(
        s.dial.map((d) => d.char),
        rand
      );
      const dial: DialLetter[] = chars.map((char, id) => ({ id, char, placed: false }));
      // Re-bind each filled slot to a distinct tile carrying the right letter.
      const slots = s.slots.map((slot) => {
        if (!slot) return slot;
        const tile = dial.find((d) => !d.placed && d.char === slot.char);
        if (!tile) return slot;
        tile.placed = true;
        return { ...slot, dialId: tile.id };
      });
      return { ...s, dial, slots };
    });
  }

  /**
   * Buy a hint. `reveal` places one correct letter and locks it; `hint` surfaces the
   * authored clue; `definition` surfaces the full definition. All local, no network.
   */
  function useHint(kind: HintKind) {
    touch();
    store.update((s) => {
      if (s.status !== "playing") return s;
      if (s.hintsUsed.includes(kind)) return s;

      const hintsUsed = [...s.hintsUsed, kind];

      if (kind === "hint") return { ...s, hintsUsed, hintText: s.current.h };
      if (kind === "definition") return { ...s, hintsUsed, definitionShown: true };

      // reveal: fill the first slot that isn't already correct.
      const slotIndex = s.slots.findIndex(
        (slot, i) => slot === null || slot.char !== s.target[i]
      );
      if (slotIndex === -1) return { ...s, hintsUsed };

      const wanted = s.target[slotIndex];
      let slots = s.slots.slice();
      let dial = s.dial.slice();

      // Evict whatever is sitting in that slot first.
      const occupant = slots[slotIndex];
      if (occupant && !occupant.locked) {
        dial = dial.map((d) => (d.id === occupant.dialId ? { ...d, placed: false } : d));
        slots[slotIndex] = null;
      }

      const tile = dial.find((d) => !d.placed && d.char === wanted);
      if (!tile) return { ...s, hintsUsed, slots, dial };

      slots[slotIndex] = { char: wanted, dialId: tile.id, locked: true };
      dial = dial.map((d) => (d.id === tile.id ? { ...d, placed: true } : d));

      return evaluate({ ...s, hintsUsed, slots, dial });
    });
  }

  /** Give up on the current word: show it, score nothing, break the combo. */
  function skip() {
    store.update((s) => {
      if (s.status === "correct") return s;
      const solved: SolvedWord = {
        word: s.current.w,
        definition: s.current.d,
        tier: s.current.tier,
        score: 0,
        elapsedMs: elapsed(),
        hintsUsed: [...s.hintsUsed],
        clean: false,
        solved: false,
      };
      const slots = s.target
        .split("")
        .map((char, i) => ({ char, dialId: -1 - i, locked: true }));
      return {
        ...s,
        status: "revealed",
        slots,
        dial: s.dial.map((d) => ({ ...d, placed: true })),
        definitionShown: true,
        streak: 0,
        results: [...s.results, solved],
      };
    });
  }

  function next() {
    firstInteractionAt = null;
    store.update((s) => {
      const index = s.index + 1;
      if (index >= s.words.length) return { ...s, finished: true };
      return { ...s, index, ...startWord(s.words[index], rand) };
    });
  }

  function finish() {
    store.update((s) => ({ ...s, finished: true }));
  }

  function result(date: string): RoundResult {
    const s = get(store);
    return {
      mode: s.mode,
      date,
      words: s.results,
      totalScore: s.totalScore,
      peakCombo: s.peakCombo,
      solvedCount: s.results.filter((r) => r.solved).length,
    };
  }

  /** Route a keydown into the right action. Returns true if it was consumed. */
  function handleKey(event: KeyboardEvent): boolean {
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    const s = get(store);

    if (event.key === "Backspace") {
      if (s.status === "playing") undo();
      return true;
    }
    if (event.key === "Enter") {
      if (s.status === "correct" || s.status === "revealed") next();
      return true;
    }
    if (event.key === " ") {
      if (s.status === "playing") reshuffle();
      return true;
    }
    if (event.key === "Escape") {
      if (s.status === "playing") reset();
      return true;
    }
    if (/^[a-zA-Z]$/.test(event.key)) {
      if (s.status === "playing") typeLetter(event.key);
      return true;
    }
    return false;
  }

  return {
    subscribe: store.subscribe,
    place,
    typeLetter,
    undo,
    undoAt,
    reset,
    reshuffle,
    clearWrong,
    useHint,
    skip,
    next,
    finish,
    result,
    handleKey,
  };
}

export type Session = ReturnType<typeof createSession>;
