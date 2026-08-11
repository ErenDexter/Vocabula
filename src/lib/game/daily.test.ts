import { describe, expect, it } from "vitest";
import { DAILY_WORD_COUNT, prettyDate, puzzleForDate, todayIso } from "./daily";
import { toIsoDate } from "./rng";

const DATE = "2026-08-11";

describe("puzzleForDate", () => {
  it("returns the configured number of words", () => {
    expect(puzzleForDate(DATE)).toHaveLength(DAILY_WORD_COUNT);
  });

  it("returns the identical puzzle across a thousand calls", () => {
    const first = puzzleForDate(DATE).map((w) => w.w);
    for (let i = 0; i < 1000; i++) {
      expect(puzzleForDate(DATE).map((w) => w.w)).toEqual(first);
    }
  });

  it("never repeats a word within one puzzle", () => {
    const words = puzzleForDate(DATE).map((w) => w.w);
    expect(new Set(words).size).toBe(words.length);
  });

  it("ramps difficulty from common to rare", () => {
    expect(puzzleForDate(DATE).map((w) => w.tier)).toEqual([
      "common",
      "common",
      "uncommon",
      "uncommon",
      "rare",
    ]);
  });

  it("gives different dates different puzzles", () => {
    const a = puzzleForDate("2026-08-11").map((w) => w.w).join();
    const b = puzzleForDate("2026-08-12").map((w) => w.w).join();
    expect(a).not.toBe(b);
  });

  it("keeps a year of puzzles overwhelmingly distinct", () => {
    const seen = new Set<string>();
    const day = new Date("2026-01-01T00:00:00");
    for (let i = 0; i < 365; i++) {
      seen.add(puzzleForDate(toIsoDate(day)).map((w) => w.w).join());
      day.setDate(day.getDate() + 1);
    }
    expect(seen.size).toBeGreaterThan(360);
  });

  it("only draws real pack entries, with definitions and hints", () => {
    for (const word of puzzleForDate(DATE)) {
      expect(word.w).toMatch(/^[a-z]{3,10}$/);
      expect(word.d.length).toBeGreaterThan(20);
      expect(word.h.length).toBeGreaterThan(0);
    }
  });
});

describe("todayIso", () => {
  it("formats a supplied date in local time", () => {
    expect(todayIso(new Date(2026, 7, 11))).toBe("2026-08-11");
  });
});

describe("prettyDate", () => {
  it("renders a short human date", () => {
    expect(prettyDate("2026-08-11")).toBe("11 Aug 2026");
    expect(prettyDate("2026-01-01")).toBe("1 Jan 2026");
  });
});
