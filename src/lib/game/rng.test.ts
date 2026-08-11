import { describe, expect, it } from "vitest";
import {
  dateSeed,
  hashString,
  mulberry32,
  pick,
  puzzleNumber,
  sample,
  shuffle,
  toIsoDate,
} from "./rng";

describe("mulberry32", () => {
  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = Array.from({ length: 20 }, mulberry32(1));
    const b = Array.from({ length: 20 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it("stays within [0, 1)", () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 2000; i++) {
      const value = rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("hashString / dateSeed", () => {
  it("is stable for the same input", () => {
    expect(hashString("2026-08-11")).toBe(hashString("2026-08-11"));
    expect(dateSeed("2026-08-11")).toBe(dateSeed("2026-08-11"));
  });

  it("gives adjacent dates different seeds", () => {
    expect(dateSeed("2026-08-11")).not.toBe(dateSeed("2026-08-12"));
    expect(dateSeed("2026-08-11")).not.toBe(dateSeed("2026-08-10"));
  });

  it("gives a full year of dates distinct seeds", () => {
    const seeds = new Set<number>();
    const day = new Date("2026-01-01T00:00:00");
    for (let i = 0; i < 365; i++) {
      seeds.add(dateSeed(toIsoDate(day)));
      day.setDate(day.getDate() + 1);
    }
    expect(seeds.size).toBe(365);
  });
});

describe("toIsoDate", () => {
  it("zero-pads month and day", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toIsoDate(new Date(2026, 10, 30))).toBe("2026-11-30");
  });
});

describe("puzzleNumber", () => {
  it("counts days from the epoch, starting at one", () => {
    expect(puzzleNumber("2026-01-01")).toBe(1);
    expect(puzzleNumber("2026-01-02")).toBe(2);
    expect(puzzleNumber("2027-01-01")).toBe(366);
  });

  it("increases by exactly one per day across a month boundary", () => {
    expect(puzzleNumber("2026-02-01") - puzzleNumber("2026-01-31")).toBe(1);
  });
});

describe("shuffle", () => {
  it("is deterministic for a given seed and keeps every element", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle(items, mulberry32(7));
    const b = shuffle(items, mulberry32(7));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });

  it("does not mutate its input", () => {
    const items = [1, 2, 3];
    shuffle(items, mulberry32(1));
    expect(items).toEqual([1, 2, 3]);
  });
});

describe("sample", () => {
  it("returns n distinct items", () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const drawn = sample(items, 10, mulberry32(3));
    expect(drawn).toHaveLength(10);
    expect(new Set(drawn).size).toBe(10);
  });

  it("caps at the pool size rather than repeating", () => {
    expect(sample([1, 2, 3], 10, mulberry32(3))).toHaveLength(3);
  });

  it("returns nothing for a non-positive count", () => {
    expect(sample([1, 2, 3], 0, mulberry32(3))).toEqual([]);
    expect(sample([1, 2, 3], -5, mulberry32(3))).toEqual([]);
  });
});

describe("pick", () => {
  it("throws on an empty pool rather than returning undefined", () => {
    expect(() => pick([], mulberry32(1))).toThrow();
  });
});
