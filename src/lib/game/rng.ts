/**
 * Seeded randomness. Every draw the daily challenge makes has to be reproducible
 * from nothing but the date, on any device, with no network — so all of it goes
 * through these helpers rather than Math.random().
 */

/** Small, fast, well-distributed 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a. Turns an arbitrary string (like "2026-08-11") into a 32-bit seed. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seed for a given ISO date string. */
export function dateSeed(isoDate: string): number {
  return hashString(`vocabula:${isoDate}`);
}

/** Local-time YYYY-MM-DD. Deliberately not UTC: the puzzle rolls over at the player's midnight. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Days elapsed since the game's epoch, used as the daily puzzle number. */
const EPOCH = "2026-01-01";
export function puzzleNumber(isoDate: string): number {
  const ms = Date.parse(`${isoDate}T00:00:00`) - Date.parse(`${EPOCH}T00:00:00`);
  return Math.floor(ms / 86_400_000) + 1;
}

/** Fisher-Yates against a supplied generator. Returns a new array. */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Draw n distinct items. Returns fewer than n only if the pool is smaller. */
export function sample<T>(items: readonly T[], n: number, rand: () => number): T[] {
  return shuffle(items, rand).slice(0, Math.max(0, n));
}

/** Draw one item. Throws on an empty pool rather than returning undefined. */
export function pick<T>(items: readonly T[], rand: () => number): T {
  if (items.length === 0) throw new Error("pick() called on an empty pool");
  return items[Math.floor(rand() * items.length)];
}

/** An unseeded generator, for anything that shouldn't be reproducible (letter shuffles). */
export const systemRandom = (): number => Math.random();
