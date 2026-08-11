import type { Tier, Word } from "../types";
import { sample, shuffle } from "../game/rng";
import { COMMON } from "./words-common";
import { UNCOMMON } from "./words-uncommon";
import { RARE } from "./words-rare";

function tag(entries: typeof COMMON, tier: Tier): Word[] {
  return entries.map((e) => ({ ...e, tier }));
}

export const ALL_WORDS: Word[] = [
  ...tag(COMMON, "common"),
  ...tag(UNCOMMON, "uncommon"),
  ...tag(RARE, "rare"),
];

export const MIN_LENGTH = ALL_WORDS.reduce((m, w) => Math.min(m, w.w.length), Infinity);
export const MAX_LENGTH = ALL_WORDS.reduce((m, w) => Math.max(m, w.w.length), 0);

/** Every distinct topic tag in the pack, sorted. Used for topic suggestions in the UI. */
export const ALL_TAGS: string[] = [
  ...new Set(ALL_WORDS.flatMap((w) => w.t)),
].sort();

export function byTier(tier: Tier): Word[] {
  return ALL_WORDS.filter((w) => w.tier === tier);
}

export function byLength(length: number): Word[] {
  return ALL_WORDS.filter((w) => w.w.length === length);
}

export function byMaxLength(maxLetters: number): Word[] {
  return ALL_WORDS.filter((w) => w.w.length <= maxLetters);
}

export function findWord(word: string): Word | undefined {
  const needle = word.toLowerCase();
  return ALL_WORDS.find((w) => w.w === needle);
}

/**
 * Free-text topic matching against the local pack.
 * Matches a word if any token of the query hits its tags, its own text, or its definition.
 */
export function byTopic(topic: string, pool: readonly Word[] = ALL_WORDS): Word[] {
  const tokens = topic
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 2);
  if (tokens.length === 0) return [];

  return pool.filter((word) => {
    const haystack = `${word.w} ${word.t.join(" ")} ${word.d.toLowerCase()}`;
    return tokens.some((t) => haystack.includes(t));
  });
}

export interface WordQuery {
  count: number;
  /** Longest word to include, or null for any length. */
  maxLetters?: number | null;
  tier?: Tier | null;
  topic?: string | null;
  /** Words to leave out, lowercase. */
  exclude?: readonly string[];
}

/**
 * Draw words for a round.
 *
 * Constraints are relaxed in a fixed order when the pack can't satisfy them all —
 * topic first, then tier, then length — so a demanding query degrades into a looser
 * one instead of returning a short list. Only an exhausted pack returns fewer than
 * `count` words.
 */
export function queryWords(query: WordQuery, rand: () => number): Word[] {
  const excluded = new Set((query.exclude ?? []).map((w) => w.toLowerCase()));
  const available = ALL_WORDS.filter((w) => !excluded.has(w.w));

  const byLen = (pool: readonly Word[]) =>
    query.maxLetters == null
      ? pool.slice()
      : pool.filter((w) => w.w.length <= query.maxLetters!);
  const byTierFn = (pool: readonly Word[]) =>
    query.tier == null ? pool.slice() : pool.filter((w) => w.tier === query.tier);
  const byTopicFn = (pool: readonly Word[]) =>
    query.topic == null || query.topic.trim() === ""
      ? pool.slice()
      : byTopic(query.topic, pool);

  // Tightest first; each fallback drops one more constraint.
  const tiers: Word[][] = [
    byTopicFn(byTierFn(byLen(available))),
    byTierFn(byLen(available)),
    byLen(available),
    available,
  ];

  const chosen: Word[] = [];
  const taken = new Set<string>();
  for (const pool of tiers) {
    if (chosen.length >= query.count) break;
    const fresh = shuffle(
      pool.filter((w) => !taken.has(w.w)),
      rand
    );
    for (const word of fresh) {
      if (chosen.length >= query.count) break;
      chosen.push(word);
      taken.add(word.w);
    }
  }

  return chosen;
}

/** Convenience wrapper for an unconstrained draw. */
export function randomWords(count: number, rand: () => number): Word[] {
  return sample(ALL_WORDS, count, rand);
}
