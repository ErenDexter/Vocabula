import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import type { Word } from "../types";
import { createSession, type SessionState } from "./session";
import { mulberry32 } from "./rng";
import { HINT_COSTS } from "./scoring";

const CAT: Word = {
  w: "arc",
  d: "A curved line, part of the circumference of a circle or any similar bend.",
  h: "A curved path through the air",
  t: ["motion"],
  tier: "common",
};

const DOG: Word = {
  w: "orbit",
  d: "The curved path one body traces around another under gravity.",
  h: "Path a moon follows forever",
  t: ["space"],
  tier: "common",
};

/** A deterministic session, so shuffles are reproducible between runs. */
function session(words: Word[] = [CAT]) {
  return createSession(words, "quick", mulberry32(1));
}

/** Type the target word one letter at a time. */
function solve(s: ReturnType<typeof session>, target: string) {
  for (const char of target) s.typeLetter(char);
}

/** Deliberately place letters in an order that is not the answer. */
function fillWrong(s: ReturnType<typeof session>) {
  const state = get(s) as SessionState;
  // Place every tile in dial order; for a shuffled dial this is not the target.
  for (const tile of state.dial) s.place(tile.id);
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("setup", () => {
  it("refuses an empty word list", () => {
    expect(() => createSession([], "quick")).toThrow();
  });

  it("starts on the first word with empty slots", () => {
    const state = get(session());
    expect(state.target).toBe("ARC");
    expect(state.slots).toEqual([null, null, null]);
    expect(state.dial).toHaveLength(3);
    expect(state.status).toBe("playing");
    expect(state.totalScore).toBe(0);
  });

  it("never presents the dial already in the answer's order", () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = createSession([DOG], "quick", mulberry32(seed));
      const dial = get(s).dial.map((d) => d.char).join("");
      expect(dial).not.toBe("ORBIT");
    }
  });

  it("shuffles the same way for the same seed", () => {
    const a = get(createSession([DOG], "quick", mulberry32(5))).dial.map((d) => d.char);
    const b = get(createSession([DOG], "quick", mulberry32(5))).dial.map((d) => d.char);
    expect(a).toEqual(b);
  });
});

describe("placing letters", () => {
  it("fills the next empty slot and marks the tile used", () => {
    const s = session();
    const first = get(s).dial[0];
    s.place(first.id);

    const state = get(s);
    expect(state.slots[0]).toMatchObject({ char: first.char, dialId: first.id });
    expect(state.dial.find((d) => d.id === first.id)?.placed).toBe(true);
  });

  it("ignores a tile that is already placed", () => {
    const s = session();
    const first = get(s).dial[0];
    s.place(first.id);
    s.place(first.id);
    expect(get(s).slots.filter(Boolean)).toHaveLength(1);
  });

  it("routes a typed letter to a matching unplaced tile", () => {
    const s = session();
    s.typeLetter("a");
    expect(get(s).slots[0]?.char).toBe("A");
  });

  it("ignores a typed letter that is not on the dial", () => {
    const s = session();
    s.typeLetter("z");
    expect(get(s).slots.filter(Boolean)).toHaveLength(0);
  });

  it("handles duplicate letters as separate tiles", () => {
    const s = createSession(
      [{ ...CAT, w: "ebb", d: CAT.d, h: CAT.h }],
      "quick",
      mulberry32(2)
    );
    solve(s, "EBB");
    expect(get(s).status).toBe("correct");
  });
});

describe("solving", () => {
  it("marks a correct word and scores it", () => {
    const s = session();
    solve(s, "ARC");

    const state = get(s);
    expect(state.status).toBe("correct");
    expect(state.streak).toBe(1);
    expect(state.peakCombo).toBe(1);
    expect(state.totalScore).toBeGreaterThan(0);
    expect(state.results).toHaveLength(1);
    expect(state.results[0]).toMatchObject({ word: "arc", solved: true, clean: true });
    expect(state.definitionShown).toBe(true);
  });

  it("rejects a wrong arrangement and breaks the combo", () => {
    const s = createSession([DOG], "quick", mulberry32(3));
    fillWrong(s);

    const state = get(s);
    expect(state.status).toBe("wrong");
    expect(state.streak).toBe(0);
    expect(state.dirty).toBe(true);
    expect(state.results).toHaveLength(0);
  });

  it("returns the letters to the dial after a wrong answer", () => {
    const s = createSession([DOG], "quick", mulberry32(3));
    fillWrong(s);
    s.clearWrong();

    const state = get(s);
    expect(state.status).toBe("playing");
    expect(state.slots.every((slot) => slot === null)).toBe(true);
    expect(state.dial.every((d) => !d.placed)).toBe(true);
    expect(state.dirty).toBe(true);
  });

  it("ignores further placements while judging a wrong answer", () => {
    const s = createSession([DOG], "quick", mulberry32(3));
    fillWrong(s);
    const before = get(s).slots;
    s.typeLetter("o");
    expect(get(s).slots).toEqual(before);
  });
});

describe("undo", () => {
  it("returns a letter to the dial when its slot is tapped", () => {
    const s = session();
    s.typeLetter("a");
    s.undoAt(0);

    const state = get(s);
    expect(state.slots[0]).toBeNull();
    expect(state.dial.some((d) => d.char === "A" && !d.placed)).toBe(true);
  });

  it("costs the clean bonus but does not force a full reset", () => {
    const s = session();
    s.typeLetter("c");
    s.undoAt(0);
    solve(s, "ARC");

    const state = get(s);
    expect(state.status).toBe("correct");
    expect(state.results[0].clean).toBe(false);
    expect(state.lastBreakdown?.clean).toBe(0);
  });

  it("backspace removes the most recent letter", () => {
    const s = session();
    s.typeLetter("a");
    s.typeLetter("r");
    s.undo();

    const state = get(s);
    expect(state.slots[0]?.char).toBe("A");
    expect(state.slots[1]).toBeNull();
  });

  it("backspace on an empty row is a no-op", () => {
    const s = session();
    expect(() => s.undo()).not.toThrow();
    expect(get(s).slots.every((slot) => slot === null)).toBe(true);
  });

  it("reset clears everything and marks the word dirty", () => {
    const s = session();
    s.typeLetter("a");
    s.typeLetter("r");
    s.reset();

    const state = get(s);
    expect(state.slots.every((slot) => slot === null)).toBe(true);
    expect(state.dial.every((d) => !d.placed)).toBe(true);
    expect(state.dirty).toBe(true);
  });
});

describe("reshuffle", () => {
  it("keeps every letter and preserves what is already placed", () => {
    const s = createSession([DOG], "quick", mulberry32(4));
    s.typeLetter("o");
    s.typeLetter("r");
    s.reshuffle();

    const state = get(s);
    expect(state.dial.map((d) => d.char).sort()).toEqual("ORBIT".split("").sort());
    expect(state.slots[0]?.char).toBe("O");
    expect(state.slots[1]?.char).toBe("R");
    expect(state.dial.filter((d) => d.placed)).toHaveLength(2);
  });

  it("re-binds placed slots to distinct tiles", () => {
    const s = createSession([DOG], "quick", mulberry32(4));
    s.typeLetter("o");
    s.typeLetter("r");
    s.reshuffle();

    const ids = get(s)
      .slots.filter((slot) => slot !== null)
      .map((slot) => slot!.dialId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("can still be solved after reshuffling", () => {
    const s = createSession([DOG], "quick", mulberry32(4));
    s.reshuffle();
    solve(s, "ORBIT");
    expect(get(s).status).toBe("correct");
  });
});

describe("hints", () => {
  it("reveal places a correct letter and locks it", () => {
    const s = createSession([DOG], "quick", mulberry32(6));
    s.useHint("reveal");

    const state = get(s);
    expect(state.slots[0]).toMatchObject({ char: "O", locked: true });
    expect(state.hintsUsed).toEqual(["reveal"]);
  });

  it("a locked letter cannot be undone", () => {
    const s = createSession([DOG], "quick", mulberry32(6));
    s.useHint("reveal");
    s.undoAt(0);
    expect(get(s).slots[0]?.char).toBe("O");
  });

  it("reveal evicts a wrong letter sitting in the target slot", () => {
    const s = createSession([DOG], "quick", mulberry32(6));
    s.typeLetter("t"); // wrong first letter
    s.useHint("reveal");

    const state = get(s);
    expect(state.slots[0]).toMatchObject({ char: "O", locked: true });
    expect(state.dial.some((d) => d.char === "T" && !d.placed)).toBe(true);
  });

  it("reveal can finish and score the word", () => {
    const s = session();
    s.useHint("reveal");
    s.useHint("reveal");
    s.useHint("reveal");
    // Only one reveal is charged; the rest are ignored as duplicates.
    solve(s, "ARC");
    expect(get(s).status).toBe("correct");
  });

  it("hint surfaces the authored clue", () => {
    const s = session();
    s.useHint("hint");
    expect(get(s).hintText).toBe(CAT.h);
  });

  it("definition surfaces the definition", () => {
    const s = session();
    s.useHint("definition");
    expect(get(s).definitionShown).toBe(true);
  });

  it("charges each tier once, however many times it is clicked", () => {
    const s = session();
    s.useHint("hint");
    s.useHint("hint");
    expect(get(s).hintsUsed).toEqual(["hint"]);
  });

  it("costs points but does not break the combo", () => {
    const s = session([CAT, DOG]);
    solve(s, "ARC");
    s.next();
    s.useHint("hint");
    solve(s, "ORBIT");

    const state = get(s);
    expect(state.streak).toBe(2);
    expect(state.lastBreakdown?.multiplier).toBe(1.2);
    expect(state.lastBreakdown?.hintCost).toBe(HINT_COSTS.hint);
    expect(state.lastBreakdown?.noHint).toBe(0);
  });
});

describe("skip", () => {
  it("reveals the word, scores nothing, and breaks the combo", () => {
    const s = session([CAT, DOG]);
    solve(s, "ARC");
    s.next();
    s.skip();

    const state = get(s);
    expect(state.status).toBe("revealed");
    expect(state.slots.map((slot) => slot?.char).join("")).toBe("ORBIT");
    expect(state.streak).toBe(0);
    expect(state.results[1]).toMatchObject({ word: "orbit", solved: false, score: 0 });
    expect(state.totalScore).toBe(state.results[0].score);
  });

  it("does nothing once the word is already solved", () => {
    const s = session();
    solve(s, "ARC");
    const before = get(s).results.length;
    s.skip();
    expect(get(s).results).toHaveLength(before);
  });
});

describe("advancing", () => {
  it("moves to the next word with a fresh board", () => {
    const s = session([CAT, DOG]);
    solve(s, "ARC");
    s.next();

    const state = get(s);
    expect(state.index).toBe(1);
    expect(state.target).toBe("ORBIT");
    expect(state.slots).toHaveLength(5);
    expect(state.slots.every((slot) => slot === null)).toBe(true);
    expect(state.hintsUsed).toEqual([]);
    expect(state.dirty).toBe(false);
    expect(state.status).toBe("playing");
  });

  it("keeps the running score across words", () => {
    const s = session([CAT, DOG]);
    solve(s, "ARC");
    const afterFirst = get(s).totalScore;
    s.next();
    solve(s, "ORBIT");
    expect(get(s).totalScore).toBeGreaterThan(afterFirst);
  });

  it("finishes at the end of the list", () => {
    const s = session([CAT]);
    solve(s, "ARC");
    s.next();
    expect(get(s).finished).toBe(true);
  });

  it("builds a result for the journal", () => {
    const s = session([CAT, DOG]);
    solve(s, "ARC");
    s.next();
    s.skip();
    s.finish();

    const result = s.result("2026-08-11");
    expect(result).toMatchObject({
      mode: "quick",
      date: "2026-08-11",
      solvedCount: 1,
      peakCombo: 1,
    });
    expect(result.words).toHaveLength(2);
  });
});

describe("the combo ladder", () => {
  it("climbs with consecutive solves", () => {
    const words = Array.from({ length: 5 }, () => CAT);
    const s = createSession(words, "quick", mulberry32(8));

    const multipliers: number[] = [];
    for (let i = 0; i < words.length; i++) {
      solve(s, "ARC");
      multipliers.push(get(s).lastBreakdown!.multiplier);
      s.next();
    }
    expect(multipliers).toEqual([1, 1.2, 1.5, 1.5, 2]);
    expect(get(s).peakCombo).toBe(5);
  });

  it("restarts after a skip but remembers the peak", () => {
    const words = [CAT, CAT, CAT, CAT];
    const s = createSession(words, "quick", mulberry32(8));
    solve(s, "ARC");
    s.next();
    solve(s, "ARC");
    s.next();
    s.skip();
    s.next();
    solve(s, "ARC");

    const state = get(s);
    expect(state.streak).toBe(1);
    expect(state.peakCombo).toBe(2);
    expect(state.lastBreakdown?.multiplier).toBe(1);
  });
});

describe("keyboard routing", () => {
  const key = (init: Partial<KeyboardEvent>) => init as KeyboardEvent;

  it("types a letter", () => {
    const s = session();
    expect(s.handleKey(key({ key: "a" }))).toBe(true);
    expect(get(s).slots[0]?.char).toBe("A");
  });

  it("backspaces", () => {
    const s = session();
    s.typeLetter("a");
    s.handleKey(key({ key: "Backspace" }));
    expect(get(s).slots[0]).toBeNull();
  });

  it("reshuffles on space and clears on escape", () => {
    const s = createSession([DOG], "quick", mulberry32(9));
    s.typeLetter("o");
    expect(s.handleKey(key({ key: " " }))).toBe(true);
    expect(get(s).slots[0]?.char).toBe("O");
    expect(s.handleKey(key({ key: "Escape" }))).toBe(true);
    expect(get(s).slots[0]).toBeNull();
  });

  it("advances on enter once a word is resolved", () => {
    const s = session([CAT, DOG]);
    solve(s, "ARC");
    s.handleKey(key({ key: "Enter" }));
    expect(get(s).index).toBe(1);
  });

  it("declines modified keystrokes so browser shortcuts still work", () => {
    const s = session();
    expect(s.handleKey(key({ key: "a", metaKey: true }))).toBe(false);
    expect(s.handleKey(key({ key: "r", ctrlKey: true }))).toBe(false);
    expect(get(s).slots[0]).toBeNull();
  });

  it("declines keys it has no use for", () => {
    const s = session();
    expect(s.handleKey(key({ key: "F5" }))).toBe(false);
    expect(s.handleKey(key({ key: "1" }))).toBe(false);
  });
});
