import { describe, expect, it } from "vitest";
import {
  ALL_TAGS,
  ALL_WORDS,
  MAX_LENGTH,
  MIN_LENGTH,
  byLength,
  byMaxLength,
  byTier,
  byTopic,
  findWord,
  queryWords,
  randomWords,
} from "./index";
import { mulberry32 } from "../game/rng";

const rand = () => mulberry32(42)();

describe("the pack itself", () => {
  it("has a healthy number of words in every tier", () => {
    expect(byTier("common").length).toBeGreaterThanOrEqual(70);
    expect(byTier("uncommon").length).toBeGreaterThanOrEqual(70);
    expect(byTier("rare").length).toBeGreaterThanOrEqual(70);
  });

  it("contains no duplicate words", () => {
    const words = ALL_WORDS.map((w) => w.w);
    expect(new Set(words).size).toBe(words.length);
  });

  it("stores every word lowercase, letters only, within dial range", () => {
    for (const word of ALL_WORDS) {
      expect(word.w).toMatch(/^[a-z]+$/);
      expect(word.w.length).toBeGreaterThanOrEqual(3);
      expect(word.w.length).toBeLessThanOrEqual(10);
    }
  });

  it("gives every word a definition and at least one tag", () => {
    for (const word of ALL_WORDS) {
      expect(word.d.length).toBeGreaterThan(20);
      expect(word.t.length).toBeGreaterThan(0);
    }
  });

  it("never leaks the answer in its own hint", () => {
    for (const word of ALL_WORDS) {
      expect(word.h.toLowerCase()).not.toContain(word.w);
      expect(word.h.split(/\s+/).length).toBeLessThanOrEqual(10);
    }
  });

  it("exposes sane length bounds", () => {
    expect(MIN_LENGTH).toBeGreaterThanOrEqual(3);
    expect(MAX_LENGTH).toBeLessThanOrEqual(10);
    expect(MIN_LENGTH).toBeLessThan(MAX_LENGTH);
  });

  it("exposes its topic tags", () => {
    expect(ALL_TAGS.length).toBeGreaterThan(10);
    expect(ALL_TAGS).toEqual([...ALL_TAGS].sort());
  });
});

describe("filters", () => {
  it("byLength matches exactly", () => {
    for (const word of byLength(6)) expect(word.w).toHaveLength(6);
  });

  it("byMaxLength never returns anything longer", () => {
    for (const word of byMaxLength(6)) {
      expect(word.w.length).toBeLessThanOrEqual(6);
    }
  });

  it("byTier returns only that tier", () => {
    for (const word of byTier("rare")) expect(word.tier).toBe("rare");
  });

  it("findWord is case-insensitive and returns undefined for a miss", () => {
    expect(findWord("ANCHOR")?.w).toBe("anchor");
    expect(findWord("zzzznotaword")).toBeUndefined();
  });
});

describe("byTopic", () => {
  it("matches on tags", () => {
    const hits = byTopic("music").map((w) => w.w);
    expect(hits).toContain("violin");
  });

  it("matches on definition text", () => {
    expect(byTopic("waterfall").map((w) => w.w)).toContain("cascade");
  });

  it("ignores tokens of two letters or fewer", () => {
    expect(byTopic("a of")).toEqual([]);
  });
});

describe("queryWords", () => {
  it("returns exactly the count asked for", () => {
    expect(queryWords({ count: 12 }, rand)).toHaveLength(12);
  });

  it("never repeats a word within one draw", () => {
    const words = queryWords({ count: 20 }, rand).map((w) => w.w);
    expect(new Set(words).size).toBe(20);
  });

  it("honours maxLetters when the pack can satisfy it", () => {
    for (const word of queryWords({ count: 10, maxLetters: 6 }, rand)) {
      expect(word.w.length).toBeLessThanOrEqual(6);
    }
  });

  it("honours the tier when the pack can satisfy it", () => {
    for (const word of queryWords({ count: 10, tier: "rare" }, rand)) {
      expect(word.tier).toBe("rare");
    }
  });

  it("excludes words it is told to skip", () => {
    const skip = ALL_WORDS.slice(0, 100).map((w) => w.w);
    const drawn = queryWords({ count: 20, exclude: skip }, rand);
    for (const word of drawn) expect(skip).not.toContain(word.w);
  });

  it("relaxes constraints rather than returning a short list", () => {
    // No 4-letter rare words about music exist; it must still fill the round.
    const drawn = queryWords(
      { count: 15, maxLetters: 4, tier: "rare", topic: "music" },
      rand
    );
    expect(drawn).toHaveLength(15);
    expect(new Set(drawn.map((w) => w.w)).size).toBe(15);
  });

  it("caps at the pack size when asked for more than exists", () => {
    const drawn = queryWords({ count: ALL_WORDS.length + 50 }, rand);
    expect(drawn).toHaveLength(ALL_WORDS.length);
  });

  it("is reproducible from a seeded generator", () => {
    const a = queryWords({ count: 8 }, mulberry32(5)).map((w) => w.w);
    const b = queryWords({ count: 8 }, mulberry32(5)).map((w) => w.w);
    expect(a).toEqual(b);
  });
});

describe("randomWords", () => {
  it("draws distinct words", () => {
    const drawn = randomWords(15, mulberry32(9));
    expect(new Set(drawn.map((w) => w.w)).size).toBe(15);
  });
});
