import type { Tier, Word } from "../types";
import { queryWords } from "../data";
import { dateSeed, mulberry32, puzzleNumber, toIsoDate } from "./rng";

export const DAILY_WORD_COUNT = 5;

/** Difficulty ramp: the daily always walks from easy to hard in the same shape. */
const DAILY_SHAPE: Tier[] = ["common", "common", "uncommon", "uncommon", "rare"];

/**
 * The puzzle for a given ISO date. Pure and deterministic: same date in, same five
 * words out, on any device, forever, with no network. This is the whole reason the
 * randomness in rng.ts is seeded.
 */
export function puzzleForDate(isoDate: string): Word[] {
  const rand = mulberry32(dateSeed(isoDate));
  const chosen: Word[] = [];

  for (const tier of DAILY_SHAPE) {
    const [word] = queryWords(
      { count: 1, tier, exclude: chosen.map((w) => w.w) },
      rand
    );
    if (word) chosen.push(word);
  }

  return chosen;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function todaysPuzzle(now: Date = new Date()): Word[] {
  return puzzleForDate(todayIso(now));
}

export { puzzleNumber };

/** "11 Aug" — the compact label used on the daily header and share card. */
export function prettyDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}
