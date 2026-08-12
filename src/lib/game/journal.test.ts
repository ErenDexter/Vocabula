import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoundResult, SolvedWord } from "../types";
import {
  clearAll,
  currentStreak,
  dailyRecord,
  emptyJournal,
  getSettings,
  hasPlayedDaily,
  lexicon,
  load,
  previousDay,
  recordRound,
  reviewCandidates,
  save,
  setSettings,
} from "./journal";

/** Minimal in-memory localStorage; the module only uses get/set/remove. */
function installStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  });
  return map;
}

function solved(word: string, score = 100, hints: SolvedWord["hintsUsed"] = []): SolvedWord {
  return {
    word,
    definition: `A definition of ${word} long enough to be realistic.`,
    tier: "common",
    score,
    elapsedMs: 5_000,
    hintsUsed: hints,
    clean: hints.length === 0,
    solved: true,
  };
}

function round(date: string, mode: RoundResult["mode"], words: SolvedWord[]): RoundResult {
  return {
    mode,
    date,
    words,
    totalScore: words.reduce((sum, w) => sum + w.score, 0),
    peakCombo: words.length,
    solvedCount: words.filter((w) => w.solved).length,
  };
}

let storage: Map<string, string>;
beforeEach(() => {
  storage = installStorage();
});

describe("previousDay", () => {
  it("steps back one day across month and year boundaries", () => {
    expect(previousDay("2026-08-11")).toBe("2026-08-10");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });
});

describe("load", () => {
  it("returns an empty journal when nothing is stored", () => {
    expect(load()).toEqual(emptyJournal());
  });

  it("does not throw on corrupt JSON", () => {
    storage.set("vocabula:v1", "{ this is not json");
    expect(() => load()).not.toThrow();
    expect(load()).toEqual(emptyJournal());
  });

  it("does not throw on a stored non-object", () => {
    storage.set("vocabula:v1", '"a string"');
    expect(load().lexicon).toEqual({});
  });

  it("backfills missing sections of a partial record", () => {
    storage.set("vocabula:v1", JSON.stringify({ v: 1, bestQuick: 500 }));
    const data = load();
    expect(data.bestQuick).toBe(500);
    expect(data.lexicon).toEqual({});
    expect(data.streak).toEqual({ current: 0, best: 0, lastDaily: null });
    expect(data.settings).toEqual({ sound: true });
  });

  it("round-trips through save", () => {
    const data = emptyJournal();
    data.bestQuick = 1234;
    save(data);
    expect(load().bestQuick).toBe(1234);
  });

  it("survives storage being unavailable entirely", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => load()).not.toThrow();
    expect(() => save(emptyJournal())).not.toThrow();
    expect(load()).toEqual(emptyJournal());
  });
});

describe("recordRound", () => {
  it("writes solved words into the lexicon", () => {
    recordRound(round("2026-08-11", "quick", [solved("anchor", 240)]), "🟩");
    const entries = lexicon();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      word: "anchor",
      first: "2026-08-11",
      last: "2026-08-11",
      times: 1,
      best: 240,
    });
  });

  it("merges a repeat solve and keeps the better score", () => {
    recordRound(round("2026-08-11", "quick", [solved("anchor", 240)]), "🟩");
    recordRound(round("2026-08-12", "quick", [solved("anchor", 180)]), "🟩");
    const [entry] = lexicon();
    expect(entry.times).toBe(2);
    expect(entry.best).toBe(240);
    expect(entry.first).toBe("2026-08-11");
    expect(entry.last).toBe("2026-08-12");
  });

  it("ignores skipped words", () => {
    const skipped = { ...solved("anchor"), solved: false, score: 0 };
    recordRound(round("2026-08-11", "quick", [skipped]), "⬜");
    expect(lexicon()).toHaveLength(0);
  });

  it("tracks the best quick-play score only for quick rounds", () => {
    recordRound(round("2026-08-11", "quick", [solved("anchor", 300)]), "🟩");
    expect(load().bestQuick).toBe(300);
    recordRound(round("2026-08-12", "quick", [solved("bridge", 100)]), "🟩");
    expect(load().bestQuick).toBe(300);
    recordRound(round("2026-08-13", "daily", [solved("candle", 9000)]), "🟩");
    expect(load().bestQuick).toBe(300);
  });

  it("stores the daily record with its grid", () => {
    recordRound(round("2026-08-11", "daily", [solved("anchor", 240)]), "🟩🟨⬜");
    expect(dailyRecord("2026-08-11")).toMatchObject({
      score: 240,
      solved: 1,
      total: 1,
      grid: "🟩🟨⬜",
    });
    expect(hasPlayedDaily("2026-08-11")).toBe(true);
    expect(hasPlayedDaily("2026-08-12")).toBe(false);
  });
});

describe("the daily streak", () => {
  const play = (date: string) =>
    recordRound(round(date, "daily", [solved("anchor")]), "🟩");

  it("starts at one", () => {
    play("2026-08-11");
    expect(load().streak.current).toBe(1);
  });

  it("increments on consecutive days", () => {
    play("2026-08-11");
    play("2026-08-12");
    play("2026-08-13");
    expect(load().streak.current).toBe(3);
    expect(load().streak.best).toBe(3);
  });

  it("resets after a missed day", () => {
    play("2026-08-11");
    play("2026-08-12");
    play("2026-08-15");
    expect(load().streak.current).toBe(1);
    expect(load().streak.best).toBe(2);
  });

  it("does not double-count replaying the same date", () => {
    play("2026-08-11");
    play("2026-08-11");
    expect(load().streak.current).toBe(1);
  });

  it("reports a lapsed streak as zero without rewriting storage", () => {
    play("2026-08-11");
    expect(currentStreak("2026-08-11")).toBe(1);
    expect(currentStreak("2026-08-12")).toBe(1); // still recoverable today
    expect(currentStreak("2026-08-13")).toBe(0); // missed a day
    expect(load().streak.current).toBe(1);
  });

  it("is zero before any daily is played", () => {
    expect(currentStreak("2026-08-11")).toBe(0);
  });
});

describe("reviewCandidates", () => {
  it("offers only words last seen before today, oldest first", () => {
    recordRound(round("2026-08-09", "quick", [solved("anchor")]), "🟩");
    recordRound(round("2026-08-10", "quick", [solved("bridge")]), "🟩");
    recordRound(round("2026-08-11", "quick", [solved("candle")]), "🟩");

    const words = reviewCandidates("2026-08-11").map((e) => e.word);
    expect(words).toEqual(["anchor", "bridge"]);
  });
});

describe("settings", () => {
  it("defaults sound on and persists a change", () => {
    expect(getSettings().sound).toBe(true);
    setSettings({ sound: false });
    expect(getSettings().sound).toBe(false);
  });

  it("keeps a stored choice rather than reapplying the default", () => {
    storage.set("vocabula:v1", JSON.stringify({ v: 1, settings: { sound: false } }));
    expect(getSettings().sound).toBe(false);
  });
});

describe("clearAll", () => {
  it("wipes everything back to empty", () => {
    recordRound(round("2026-08-11", "daily", [solved("anchor")]), "🟩");
    clearAll();
    expect(load()).toEqual(emptyJournal());
  });
});
