/** Rarity tiers. Determined by which data file an entry lives in. */
export type Tier = "common" | "uncommon" | "rare";

/** A raw entry as authored in the word pack data files. */
export interface WordEntry {
  /** The word, stored lowercase. Displayed uppercase. */
  w: string;
  /** Definition, roughly 30-45 words. */
  d: string;
  /** Hint, ten words or fewer, never containing the word itself. */
  h: string;
  /** Topic tags, used by the custom-topic matcher. */
  t: string[];
}

/** A word entry once its tier is known. */
export interface Word extends WordEntry {
  tier: Tier;
}

/** The three hint tiers, cheapest first. */
export type HintKind = "reveal" | "hint" | "definition";

/** How a round was configured. */
export interface RoundConfig {
  wordCount: number;
  /** null means "any length". */
  letterCount: number | null;
  /** null means "any tier". */
  tier: Tier | null;
  /** Free-text topic, or null for no topic filter. */
  topic: string | null;
}

/** Which flavour of round is being played. */
export type RoundMode = "quick" | "daily" | "warmup";

/** The per-word record produced when a word is resolved. */
export interface SolvedWord {
  word: string;
  definition: string;
  tier: Tier;
  /** Points earned, after multiplier. */
  score: number;
  /** Milliseconds from first interaction to the correct answer. */
  elapsedMs: number;
  hintsUsed: HintKind[];
  /** False if the player undid a letter, reset, or answered wrong first. */
  clean: boolean;
  /** True if the word was solved at all. */
  solved: boolean;
}

/** Everything the finish screen and the journal need about a completed round. */
export interface RoundResult {
  mode: RoundMode;
  /** ISO date, local time, YYYY-MM-DD. */
  date: string;
  words: SolvedWord[];
  totalScore: number;
  /** Highest consecutive-solve streak reached during the round. */
  peakCombo: number;
  solvedCount: number;
}
