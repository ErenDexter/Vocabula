import type { HintKind } from "../types";

export const BASE = 100;
export const PER_EXTRA_LETTER = 20;
export const NO_HINT_BONUS = 50;
export const CLEAN_BONUS = 50;
export const MAX_SPEED_BONUS = 100;
export const PAR_MS_PER_LETTER = 6_000;
/** A solve is always worth something, however many hints it took. */
export const MIN_SUBTOTAL = 10;

export const HINT_COSTS: Record<HintKind, number> = {
  reveal: 25,
  hint: 40,
  definition: 80,
};

export interface ScoreInput {
  length: number;
  elapsedMs: number;
  hintsUsed: readonly HintKind[];
  /** No undo, no reset, no wrong answer. */
  clean: boolean;
  /** Consecutive solves *including* this one. */
  streak: number;
}

export interface ScoreBreakdown {
  base: number;
  length: number;
  speed: number;
  noHint: number;
  clean: number;
  hintCost: number;
  subtotal: number;
  multiplier: number;
  total: number;
}

/** Target solve time for a word of this length. */
export function par(length: number): number {
  return length * PAR_MS_PER_LETTER;
}

/**
 * Full bonus at half par or faster, nothing at 1.5x par or slower, linear between.
 * Solving exactly at par is worth half.
 */
export function speedBonus(length: number, elapsedMs: number): number {
  const ratio = elapsedMs / par(length);
  if (!Number.isFinite(ratio) || ratio <= 0.5) return MAX_SPEED_BONUS;
  if (ratio >= 1.5) return 0;
  return Math.round(MAX_SPEED_BONUS * (1.5 - ratio));
}

/** 1.0 / 1.2 / 1.5 / 2.0 at streaks of 1 / 2 / 3-4 / 5+. */
export function comboMultiplier(streak: number): number {
  if (streak >= 5) return 2;
  if (streak >= 3) return 1.5;
  if (streak === 2) return 1.2;
  return 1;
}

export function hintCost(hintsUsed: readonly HintKind[]): number {
  return hintsUsed.reduce((sum, kind) => sum + (HINT_COSTS[kind] ?? 0), 0);
}

export function scoreWord(input: ScoreInput): ScoreBreakdown {
  const lengthBonus = Math.max(0, input.length - 3) * PER_EXTRA_LETTER;
  const speed = speedBonus(input.length, input.elapsedMs);
  const noHint = input.hintsUsed.length === 0 ? NO_HINT_BONUS : 0;
  const clean = input.clean ? CLEAN_BONUS : 0;
  const cost = hintCost(input.hintsUsed);

  const subtotal = Math.max(
    MIN_SUBTOTAL,
    BASE + lengthBonus + speed + noHint + clean - cost
  );
  const multiplier = comboMultiplier(input.streak);

  return {
    base: BASE,
    length: lengthBonus,
    speed,
    noHint,
    clean,
    hintCost: cost,
    subtotal,
    multiplier,
    total: Math.round(subtotal * multiplier),
  };
}
