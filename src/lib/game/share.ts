import type { RoundMode, RoundResult, SolvedWord } from "../types";
import { prettyDate, puzzleNumber } from "./daily";

const CLEAN = "🟩";
const HINTED = "🟨";
const MISSED = "⬜";

/** One square per word: green solved unaided, yellow solved with hints, white skipped. */
export function resultGrid(words: readonly SolvedWord[]): string {
  return words
    .map((w) => (!w.solved ? MISSED : w.hintsUsed.length === 0 ? CLEAN : HINTED))
    .join("");
}

export interface ShareOptions {
  streak?: number;
}

/**
 * The primitive form, so a stored daily record can be re-shared after a reload
 * without keeping the whole round in localStorage.
 */
export interface ShareSummary {
  mode: RoundMode;
  date: string;
  grid: string;
  solved: number;
  total: number;
  score: number;
  peakCombo: number;
  streak?: number;
}

/** The block a player copies into a chat. Deliberately spoiler-free — no words in it. */
export function shareTextFrom(summary: ShareSummary): string {
  const lines: string[] = [];

  if (summary.mode === "daily") {
    lines.push(`Vocabula #${puzzleNumber(summary.date)} · ${prettyDate(summary.date)}`);
  } else if (summary.mode === "warmup") {
    lines.push(`Vocabula warm-up · ${prettyDate(summary.date)}`);
  } else {
    lines.push(`Vocabula · ${prettyDate(summary.date)}`);
  }

  lines.push(`${summary.grid}  ${summary.solved}/${summary.total}`);

  const tail = [`${summary.score.toLocaleString("en-US")} pts`];
  if (summary.peakCombo >= 2) tail.push(`×${summary.peakCombo} combo`);
  if (summary.streak && summary.streak > 1) tail.push(`🔥 ${summary.streak}`);
  lines.push(tail.join(" · "));

  return lines.join("\n");
}

export function shareText(result: RoundResult, options: ShareOptions = {}): string {
  return shareTextFrom({
    mode: result.mode,
    date: result.date,
    grid: resultGrid(result.words),
    solved: result.solvedCount,
    total: result.words.length,
    score: result.totalScore,
    peakCombo: result.peakCombo,
    streak: options.streak,
  });
}

/** Clipboard with a textarea fallback for browsers that block the async API. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
