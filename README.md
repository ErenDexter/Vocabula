# Vocabula

A hand-drawn word game. Letters arrive scrambled on a dial; put them back in order,
learn what the word means, keep a streak going.

Built with SvelteKit, Tailwind, and [PaperCSS](https://getpapercss.com/).

## Zero runtime cost

There is no backend, no API key, and no LLM call anywhere in the shipped game. Words,
definitions, and hints all live in `src/lib/data/` and are bundled into the static site.
The whole thing plays offline.

The one optional network path is the free-text **Topic** filter, which asks
[Datamuse](https://www.datamuse.com/api/) for related words and
[dictionaryapi.dev](https://dictionaryapi.dev/) for their definitions. Both are free and
keyless, both are time-boxed to three seconds, and either failing just falls back to the
local pack. See `src/lib/net/topics.ts`.

## Modes

| Route      | What it is                                                          |
| ---------- | ------------------------------------------------------------------- |
| `/`        | Free play. Choose length, rarity, topic, and how many words.          |
| `/daily`   | Five words, identical for every player on a given date. One attempt.  |
| `/lexicon` | Every word you've solved, with its definition and when you learned it.|

The daily puzzle is derived from the date alone through a seeded PRNG
(`src/lib/game/rng.ts` → `src/lib/game/daily.ts`), so two people on opposite sides of the
world get the same five words with nothing coordinating them.

## Scoring

100 base, +20 per letter beyond three, +50 for using no hints, +50 for a clean solve, and
up to +100 for speed against a par of six seconds per letter. Consecutive solves multiply
the lot by ×1.2, ×1.5, then ×2. Hints cost points but never break a combo — only a reset
does that. All of it is in `src/lib/game/scoring.ts`.

## Controls

Tap or drag across the dial, or use the keyboard:

| Key         | Action                    |
| ----------- | ------------------------- |
| `A`–`Z`     | Place that letter         |
| `Backspace` | Take the last one back    |
| `Space`     | Reshuffle the dial        |
| `Esc`       | Clear the row             |
| `Enter`     | Next word                 |

Tapping a letter in the answer row also sends it back to the dial.

## Development

```bash
npm install
npm run dev       # dev server
npm test          # vitest, covers the pure logic in src/lib
npm run check     # svelte-check
npm run build     # static site into build/
npm run preview   # serve the built site
```

`npm run build` emits a fully prerendered site via `@sveltejs/adapter-static` — drop
`build/` on GitHub Pages, Netlify, Cloudflare Pages, or anything else that serves files.

## Growing the word pack

The pack ships hand-authored and needs no tooling. To add more:

```bash
GEMINI_API_KEY=... npm run expand-pack -- --tier=uncommon --count=40
```

`scripts/expand-pack.ts` appends validated entries to the tier's data file. It runs on
your machine only — never at build time, never in the browser — and every candidate is
checked for length, duplicates, and hints that leak the answer. Review the diff before
committing; nothing it writes is proofread.

## Project layout

```
src/lib/data/     the word pack and its query helpers
src/lib/game/     rng, scoring, daily seeding, session state, journal, share, sfx
src/lib/net/      the optional keyless topic lookup
src/components/   LetterDial, AnswerRow, HintBar, ScoreBar, FinishScreen, …
src/routes/       /, /daily, /lexicon
```

Sound effects are synthesised with WebAudio at runtime, so the repo carries no audio
assets. They default to off.
