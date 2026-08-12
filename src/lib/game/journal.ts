import type { RoundResult, SolvedWord, Tier } from "../types";

const KEY = "vocabula:v1";

export interface LexiconEntry {
  word: string;
  definition: string;
  tier: Tier;
  /** ISO date first solved. */
  first: string;
  /** ISO date most recently solved. */
  last: string;
  times: number;
  /** Best single-word score achieved. */
  best: number;
}

export interface DailyRecord {
  score: number;
  solved: number;
  total: number;
  peakCombo: number;
  /** The emoji grid, stored so the share button works after a reload. */
  grid: string;
}

export interface Settings {
  sound: boolean;
}

export interface JournalData {
  v: 1;
  lexicon: Record<string, LexiconEntry>;
  daily: Record<string, DailyRecord>;
  streak: { current: number; best: number; lastDaily: string | null };
  bestQuick: number;
  settings: Settings;
}

export function emptyJournal(): JournalData {
  return {
    v: 1,
    lexicon: {},
    daily: {},
    streak: { current: 0, best: 0, lastDaily: null },
    bestQuick: 0,
    settings: { sound: true },
  };
}

const canPersist = (): boolean =>
  typeof localStorage !== "undefined" && localStorage !== null;

/** Never throws. Corrupt or partial storage falls back to a fresh journal. */
export function load(): JournalData {
  if (!canPersist()) return emptyJournal();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyJournal();
    const parsed = JSON.parse(raw) as Partial<JournalData>;
    if (!parsed || typeof parsed !== "object") return emptyJournal();
    const base = emptyJournal();
    return {
      ...base,
      ...parsed,
      v: 1,
      lexicon: parsed.lexicon ?? base.lexicon,
      daily: parsed.daily ?? base.daily,
      streak: { ...base.streak, ...(parsed.streak ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return emptyJournal();
  }
}

export function save(data: JournalData): void {
  if (!canPersist()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private browsing). Play continues without persistence.
  }
}

export function update(fn: (data: JournalData) => JournalData): JournalData {
  const next = fn(load());
  save(next);
  return next;
}

/** Yesterday, relative to an ISO date, in ISO form. */
function previousDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function recordSolved(data: JournalData, solved: SolvedWord, date: string): void {
  if (!solved.solved) return;
  const key = solved.word.toLowerCase();
  const existing = data.lexicon[key];
  data.lexicon[key] = existing
    ? {
        ...existing,
        last: date,
        times: existing.times + 1,
        best: Math.max(existing.best, solved.score),
      }
    : {
        word: key,
        definition: solved.definition,
        tier: solved.tier,
        first: date,
        last: date,
        times: 1,
        best: solved.score,
      };
}

/** Folds a finished round into the journal: lexicon, best scores, and the daily streak. */
export function recordRound(result: RoundResult, grid: string): JournalData {
  return update((data) => {
    for (const word of result.words) recordSolved(data, word, result.date);

    if (result.mode === "daily") {
      data.daily[result.date] = {
        score: result.totalScore,
        solved: result.solvedCount,
        total: result.words.length,
        peakCombo: result.peakCombo,
        grid,
      };
      const last = data.streak.lastDaily;
      if (last !== result.date) {
        data.streak.current =
          last === previousDay(result.date) ? data.streak.current + 1 : 1;
        data.streak.lastDaily = result.date;
        data.streak.best = Math.max(data.streak.best, data.streak.current);
      }
    } else if (result.mode === "quick") {
      data.bestQuick = Math.max(data.bestQuick, result.totalScore);
    }

    return data;
  });
}

export function hasPlayedDaily(isoDate: string): boolean {
  return isoDate in load().daily;
}

export function dailyRecord(isoDate: string): DailyRecord | undefined {
  return load().daily[isoDate];
}

/**
 * The streak as it should be *displayed*: a streak whose last entry is older than
 * yesterday has already lapsed, even though nothing has written to storage since.
 */
export function currentStreak(today: string): number {
  const { current, lastDaily } = load().streak;
  if (!lastDaily) return 0;
  if (lastDaily === today || lastDaily === previousDay(today)) return current;
  return 0;
}

export function lexicon(): LexiconEntry[] {
  return Object.values(load().lexicon);
}

/** Words solved on an earlier day, oldest-seen first — the pool for a warm-up round. */
export function reviewCandidates(today: string): LexiconEntry[] {
  return lexicon()
    .filter((e) => e.last < today)
    .sort((a, b) => a.last.localeCompare(b.last));
}

export function getSettings(): Settings {
  return load().settings;
}

export function setSettings(patch: Partial<Settings>): Settings {
  return update((data) => {
    data.settings = { ...data.settings, ...patch };
    return data;
  }).settings;
}

export function clearAll(): void {
  if (!canPersist()) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export { previousDay };
