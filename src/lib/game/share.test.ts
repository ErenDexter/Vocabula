import { describe, expect, it } from "vitest";
import type { RoundResult, SolvedWord } from "../types";
import { resultGrid, shareText, shareTextFrom } from "./share";

function word(overrides: Partial<SolvedWord> = {}): SolvedWord {
  return {
    word: "anchor",
    definition: "A heavy hooked weight.",
    tier: "common",
    score: 200,
    elapsedMs: 4000,
    hintsUsed: [],
    clean: true,
    solved: true,
    ...overrides,
  };
}

describe("resultGrid", () => {
  it("marks an unaided solve green", () => {
    expect(resultGrid([word()])).toBe("🟩");
  });

  it("marks a hinted solve yellow", () => {
    expect(resultGrid([word({ hintsUsed: ["hint"] })])).toBe("🟨");
  });

  it("marks a skip white, even with no hints used", () => {
    expect(resultGrid([word({ solved: false })])).toBe("⬜");
  });

  it("keeps one square per word, in order", () => {
    const grid = resultGrid([
      word(),
      word({ hintsUsed: ["reveal"] }),
      word({ solved: false }),
      word(),
    ]);
    expect(grid).toBe("🟩🟨⬜🟩");
  });
});

describe("shareText", () => {
  const result: RoundResult = {
    mode: "daily",
    date: "2026-08-11",
    words: [word(), word(), word({ hintsUsed: ["hint"] }), word({ solved: false }), word()],
    totalScore: 1240,
    peakCombo: 3,
    solvedCount: 4,
  };

  it("leads with the puzzle number and date for a daily", () => {
    expect(shareText(result).split("\n")[0]).toBe("Vocabula #223 · 11 Aug 2026");
  });

  it("includes the grid and the solved count", () => {
    expect(shareText(result).split("\n")[1]).toBe("🟩🟩🟨⬜🟩  4/5");
  });

  it("formats the score and combo", () => {
    expect(shareText(result).split("\n")[2]).toBe("1,240 pts · ×3 combo");
  });

  it("appends a streak when there is one worth showing", () => {
    expect(shareText(result, { streak: 7 })).toContain("🔥 7");
    expect(shareText(result, { streak: 1 })).not.toContain("🔥");
  });

  it("never leaks a word", () => {
    expect(shareText(result).toLowerCase()).not.toContain("anchor");
  });

  it("labels quick and warm-up rounds differently", () => {
    expect(shareText({ ...result, mode: "quick" })).toContain("Vocabula · 11 Aug 2026");
    expect(shareText({ ...result, mode: "warmup" })).toContain("warm-up");
  });

  it("omits the combo line fragment for a peak of one", () => {
    expect(shareText({ ...result, peakCombo: 1 })).not.toContain("combo");
  });
});

describe("shareTextFrom", () => {
  it("rebuilds the same text from a stored record", () => {
    const result: RoundResult = {
      mode: "daily",
      date: "2026-08-11",
      words: [word(), word({ hintsUsed: ["hint"] })],
      totalScore: 400,
      peakCombo: 2,
      solvedCount: 2,
    };
    expect(
      shareTextFrom({
        mode: "daily",
        date: "2026-08-11",
        grid: resultGrid(result.words),
        solved: 2,
        total: 2,
        score: 400,
        peakCombo: 2,
      })
    ).toBe(shareText(result));
  });
});
