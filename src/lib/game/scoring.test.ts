import { describe, expect, it } from "vitest";
import {
  BASE,
  CLEAN_BONUS,
  HINT_COSTS,
  MAX_SPEED_BONUS,
  MIN_SUBTOTAL,
  NO_HINT_BONUS,
  PER_EXTRA_LETTER,
  comboMultiplier,
  hintCost,
  par,
  scoreWord,
  speedBonus,
} from "./scoring";

describe("par", () => {
  it("scales with word length", () => {
    expect(par(3)).toBe(18_000);
    expect(par(8)).toBe(48_000);
  });
});

describe("speedBonus", () => {
  it("awards the maximum at half par or faster", () => {
    expect(speedBonus(5, 0)).toBe(MAX_SPEED_BONUS);
    expect(speedBonus(5, par(5) * 0.5)).toBe(MAX_SPEED_BONUS);
    expect(speedBonus(5, par(5) * 0.25)).toBe(MAX_SPEED_BONUS);
  });

  it("awards half at exactly par", () => {
    expect(speedBonus(5, par(5))).toBe(MAX_SPEED_BONUS / 2);
  });

  it("awards nothing at 1.5x par or slower", () => {
    expect(speedBonus(5, par(5) * 1.5)).toBe(0);
    expect(speedBonus(5, par(5) * 10)).toBe(0);
  });

  it("never goes negative", () => {
    expect(speedBonus(4, 10_000_000)).toBe(0);
  });
});

describe("comboMultiplier", () => {
  it("follows the 1 / 1.2 / 1.5 / 2 ladder", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(2)).toBe(1.2);
    expect(comboMultiplier(3)).toBe(1.5);
  });

  it("holds 1.5 at streak four and jumps to 2 at streak five", () => {
    expect(comboMultiplier(4)).toBe(1.5);
    expect(comboMultiplier(5)).toBe(2);
  });

  it("stays at 2 beyond five", () => {
    expect(comboMultiplier(12)).toBe(2);
    expect(comboMultiplier(100)).toBe(2);
  });
});

describe("hintCost", () => {
  it("sums the tiers used", () => {
    expect(hintCost([])).toBe(0);
    expect(hintCost(["reveal"])).toBe(HINT_COSTS.reveal);
    expect(hintCost(["reveal", "hint", "definition"])).toBe(
      HINT_COSTS.reveal + HINT_COSTS.hint + HINT_COSTS.definition
    );
  });
});

describe("scoreWord", () => {
  const instant = { elapsedMs: 0, hintsUsed: [], clean: true, streak: 1 } as const;

  it("gives a three-letter clean instant solve every bonus and no length bonus", () => {
    const s = scoreWord({ length: 3, ...instant });
    expect(s.length).toBe(0);
    expect(s.speed).toBe(MAX_SPEED_BONUS);
    expect(s.noHint).toBe(NO_HINT_BONUS);
    expect(s.clean).toBe(CLEAN_BONUS);
    expect(s.subtotal).toBe(BASE + MAX_SPEED_BONUS + NO_HINT_BONUS + CLEAN_BONUS);
    expect(s.total).toBe(s.subtotal);
  });

  it("adds a length bonus per letter beyond three", () => {
    const three = scoreWord({ length: 3, ...instant });
    const eight = scoreWord({ length: 8, ...instant });
    expect(eight.length - three.length).toBe(5 * PER_EXTRA_LETTER);
  });

  it("drops the no-hint bonus and charges for the hint", () => {
    const clean = scoreWord({ length: 6, ...instant });
    const hinted = scoreWord({ length: 6, ...instant, hintsUsed: ["hint"] });
    expect(hinted.noHint).toBe(0);
    expect(hinted.hintCost).toBe(HINT_COSTS.hint);
    expect(hinted.subtotal).toBe(clean.subtotal - NO_HINT_BONUS - HINT_COSTS.hint);
  });

  it("drops the clean bonus after an undo or reset", () => {
    const dirty = scoreWord({ length: 6, ...instant, clean: false });
    expect(dirty.clean).toBe(0);
  });

  it("applies the combo multiplier to the subtotal", () => {
    const solo = scoreWord({ length: 6, ...instant, streak: 1 });
    const combo = scoreWord({ length: 6, ...instant, streak: 5 });
    expect(combo.multiplier).toBe(2);
    expect(combo.total).toBe(Math.round(solo.subtotal * 2));
  });

  it("never scores a solve below the floor, however many hints were bought", () => {
    const s = scoreWord({
      length: 4,
      elapsedMs: 10_000_000,
      hintsUsed: ["reveal", "hint", "definition"],
      clean: false,
      streak: 1,
    });
    expect(s.subtotal).toBe(MIN_SUBTOTAL);
    expect(s.total).toBeGreaterThan(0);
  });

  it("returns whole numbers", () => {
    const s = scoreWord({ length: 7, elapsedMs: 33_333, hintsUsed: [], clean: true, streak: 2 });
    expect(Number.isInteger(s.total)).toBe(true);
    expect(Number.isInteger(s.speed)).toBe(true);
  });
});
