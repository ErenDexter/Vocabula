/**
 * Optional pack expander. NOT part of the build and never runs at runtime.
 *
 * The game ships with a hand-authored pack and works fully offline without ever
 * calling this. Run it only when you want more words:
 *
 *   GEMINI_API_KEY=... npm run expand-pack -- --tier=uncommon --count=40
 *
 * The key is read from the environment (.env is gitignored) and never reaches the
 * browser bundle — @google/generative-ai is a devDependency for this file alone.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, "..", "src", "lib", "data");

const TIER_FILES = {
  common: "words-common.ts",
  uncommon: "words-uncommon.ts",
  rare: "words-rare.ts",
} as const;
type Tier = keyof typeof TIER_FILES;

interface Entry {
  w: string;
  d: string;
  h: string;
  t: string[];
}

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const TIER_BRIEF: Record<Tier, string> = {
  common: "everyday words most adults use, 4 to 7 letters",
  uncommon: "words an educated reader recognises but rarely says, 5 to 8 letters",
  rare: "literary or specialist words, 5 to 9 letters",
};

function buildPrompt(tier: Tier, count: number, existing: string[]): string {
  return [
    `Produce ${count} English ${TIER_BRIEF[tier]}.`,
    "",
    "Return ONLY a JSON array. Each element must be an object with exactly these keys:",
    '  "w": the word, lowercase, letters only, 4-9 characters',
    '  "d": a definition of 20-30 words, plain and concrete',
    '  "h": a clue of at most 10 words that NEVER contains the word or any part of it',
    '  "t": an array of 1-3 lowercase topic tags',
    "",
    "No markdown fences, no commentary, no trailing text. Just the array.",
    "",
    `Do not use any of these words: ${existing.join(", ")}`,
  ].join("\n");
}

/** Reject anything that would break the game or leak the answer in its own hint. */
function validate(entry: unknown, existing: Set<string>): Entry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Partial<Entry>;
  if (typeof e.w !== "string" || typeof e.d !== "string" || typeof e.h !== "string") {
    return null;
  }
  const w = e.w.trim().toLowerCase();
  if (!/^[a-z]{4,9}$/.test(w)) return null;
  if (existing.has(w)) return null;
  if (e.h.toLowerCase().includes(w)) return null;
  if (e.d.trim().length < 20) return null;

  const tags = Array.isArray(e.t)
    ? e.t.filter((t): t is string => typeof t === "string").slice(0, 3)
    : [];

  return { w, d: e.d.trim(), h: e.h.trim(), t: tags };
}

function serialise(entry: Entry): string {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const tags = entry.t.map((t) => `"${esc(t)}"`).join(", ");
  return `  { w: "${esc(entry.w)}", d: "${esc(entry.d)}", h: "${esc(entry.h)}", t: [${tags}] },`;
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("Set GEMINI_API_KEY in your environment (or .env) first.");
    process.exit(1);
  }

  const tier = arg("tier", "uncommon") as Tier;
  if (!(tier in TIER_FILES)) {
    console.error(`Unknown tier "${tier}". Use common, uncommon, or rare.`);
    process.exit(1);
  }
  const count = Math.min(50, Math.max(1, Number.parseInt(arg("count", "25"), 10)));

  const path = resolve(DATA, TIER_FILES[tier]);
  const source = await readFile(path, "utf8");
  const existing = new Set([...source.matchAll(/\bw:\s*"([a-z]+)"/g)].map((m) => m[1]));

  const model = new GoogleGenerativeAI(key).getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  console.log(`Asking for ${count} ${tier} words (avoiding ${existing.size} existing)…`);
  const response = await model.generateContent(
    buildPrompt(tier, count, [...existing])
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.response.text());
  } catch {
    console.error("Model did not return valid JSON. Nothing written.");
    process.exit(1);
  }
  if (!Array.isArray(parsed)) {
    console.error("Expected a JSON array. Nothing written.");
    process.exit(1);
  }

  const accepted: Entry[] = [];
  for (const candidate of parsed) {
    const entry = validate(candidate, existing);
    if (entry) {
      existing.add(entry.w);
      accepted.push(entry);
    }
  }

  if (accepted.length === 0) {
    console.error("Every candidate failed validation. Nothing written.");
    process.exit(1);
  }

  const insertion = accepted.map(serialise).join("\n");
  const marker = source.lastIndexOf("];");
  if (marker === -1) {
    console.error(`Could not find the closing "];" in ${path}. Nothing written.`);
    process.exit(1);
  }

  const updated = source.slice(0, marker) + insertion + "\n" + source.slice(marker);
  await writeFile(path, updated, "utf8");

  console.log(
    `Added ${accepted.length}/${parsed.length} to ${TIER_FILES[tier]}: ` +
      accepted.map((e) => e.w).join(", ")
  );
  console.log("Review the diff before committing — nothing here is proofread.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
