import type { Tier, Word } from "../types";
import { ALL_WORDS, byTopic, queryWords } from "../data";
import { shuffle } from "../game/rng";

/**
 * The only network path in the game, and it is strictly optional.
 *
 * Both services are free, keyless, and CORS-open. Neither is trusted: the local pack
 * answers first, every request is time-boxed, and any failure quietly tops up from
 * the pack instead of surfacing an error. The game is fully playable offline.
 */
const DATAMUSE = "https://api.datamuse.com/words";
const DICTIONARY = "https://api.dictionaryapi.dev/api/v2/entries/en";
const TIMEOUT_MS = 3_000;
const MIN_LEN = 3;
const MAX_LEN = 10;

async function fetchJson<T>(url: string, timeoutMs = TIMEOUT_MS): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface DatamuseHit {
  word: string;
  tags?: string[];
}

/** Datamuse reports corpus frequency as a "f:<n>" tag. Map it onto our three tiers. */
function tierFromFrequency(tags: string[] | undefined): Tier {
  const raw = tags?.find((t) => t.startsWith("f:"));
  const freq = raw ? Number.parseFloat(raw.slice(2)) : NaN;
  if (!Number.isFinite(freq)) return "uncommon";
  if (freq >= 10) return "common";
  if (freq >= 1) return "uncommon";
  return "rare";
}

/**
 * A hint from a definition we did not author: mask the word wherever it appears,
 * then keep the first ten words. Crude, but it never leaks the answer.
 */
function hintFromDefinition(word: string, definition: string): string {
  const masked = definition.replace(new RegExp(word, "gi"), "———");
  const words = masked.split(/\s+/).filter(Boolean).slice(0, 10);
  const text = words.join(" ").replace(/[.,;:]$/, "");
  return text.length > 0 ? text : "No clue available for this one";
}

async function defineWord(word: string): Promise<string | null> {
  type Entry = { meanings?: { definitions?: { definition?: string }[] }[] };
  const data = await fetchJson<Entry[]>(`${DICTIONARY}/${encodeURIComponent(word)}`);
  const definition = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
  return typeof definition === "string" && definition.trim().length > 0
    ? definition.trim()
    : null;
}

/** Resolve definitions a few at a time so we don't fire fifty requests at once. */
async function defineAll(words: DatamuseHit[], want: number): Promise<Word[]> {
  const out: Word[] = [];
  const batchSize = 6;

  for (let i = 0; i < words.length && out.length < want; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    const defined = await Promise.all(
      batch.map(async (hit) => {
        const definition = await defineWord(hit.word);
        if (!definition) return null;
        return {
          w: hit.word.toLowerCase(),
          d: definition,
          h: hintFromDefinition(hit.word, definition),
          t: [],
          tier: tierFromFrequency(hit.tags),
        } satisfies Word;
      })
    );
    for (const word of defined) {
      if (word && out.length < want) out.push(word);
    }
  }

  return out;
}

export interface TopicOptions {
  /** Longest word to accept, or null for any length. */
  maxLetters?: number | null;
  tier?: Tier | null;
}

/**
 * Words for a free-text topic. Returns exactly `count` words unless the entire local
 * pack is smaller than that.
 */
export async function wordsForTopic(
  topic: string,
  count: number,
  rand: () => number,
  options: TopicOptions = {}
): Promise<Word[]> {
  const trimmed = topic.trim();
  if (trimmed === "") {
    return queryWords({ count, ...options }, rand);
  }

  const ceiling = options.maxLetters ?? MAX_LEN;

  // 1. The local pack answers first. Instant, offline, always available.
  const localMatches = byTopic(trimmed).filter((w) => w.w.length <= ceiling);
  if (localMatches.length >= count) {
    return shuffle(localMatches, rand).slice(0, count);
  }

  const chosen = shuffle(localMatches, rand);
  const known = new Set(ALL_WORDS.map((w) => w.w));
  const seen = new Set(chosen.map((w) => w.w));

  // 2. Ask Datamuse for words related to the topic. Length is filtered here rather
  //    than in the query: its `sp` pattern matches an exact length, not a ceiling.
  const params = new URLSearchParams({ ml: trimmed, max: "80", md: "f" });
  const hits = await fetchJson<DatamuseHit[]>(`${DATAMUSE}?${params}`);

  if (hits && hits.length > 0) {
    const usable = hits.filter((hit) => {
      const w = hit.word?.toLowerCase() ?? "";
      if (!/^[a-z]+$/.test(w)) return false;
      if (w.length < MIN_LEN || w.length > ceiling) return false;
      if (seen.has(w) || known.has(w)) return false;
      seen.add(w);
      return true;
    });

    // 3. Definitions, from the free dictionary.
    const defined = await defineAll(
      shuffle(usable, rand),
      count - chosen.length
    );
    chosen.push(...defined);
  }

  // 4. Whatever is still missing comes from the pack. A dead third party degrades
  //    the topic filter; it never breaks the round.
  if (chosen.length < count) {
    chosen.push(
      ...queryWords(
        {
          count: count - chosen.length,
          maxLetters: options.maxLetters ?? null,
          tier: options.tier ?? null,
          exclude: [...seen],
        },
        rand
      )
    );
  }

  return chosen.slice(0, count);
}
