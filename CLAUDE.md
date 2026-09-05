# CLAUDE.md

A tiny SvelteKit / Svelte 5 app on `adapter-node`: paste markdown, get a
Reddoor-branded PDF. The work happens in `src/lib/server/` — `renderer.ts`
wraps `md-to-pdf` with a 30s timeout, `pdf-config.ts` is the page/style config
lifted from `reddoor-starter`'s `export:rfp-pdf`, and `src/routes/api/generate`
is the only endpoint. It ships as a Docker image on Render's free tier.
[README.md](README.md) has the trust model; [docs/workJournal.md](docs/workJournal.md)
has the history.

- `pnpm test` is vitest, `pnpm test:e2e` is Playwright (it boots `pnpm dev`
  itself), `pnpm check` is svelte-check. CI runs install → `pnpm build` →
  `pnpm test`. There is **no prettier or eslint here** and no `pnpm verify` —
  don't reach for the fleet's gate, this repo doesn't have it.
- **Rendering needs a real Chromium.** `puppeteer-core` downloads nothing;
  `renderer.ts` reads `PUPPETEER_EXECUTABLE_PATH` and falls back to
  `/usr/bin/chromium`. Without one the renderer test skips rather than fails.
- **The page-break policy is deliberate and tested.** Breaks key off `h1`, not
  `h2` — `tests/unit/pdf-config.test.ts` locks it. See the 2026-07-21 note in
  the journal for what breaking that costs.

## The work journal

**Every working session appends a dated entry to `docs/workJournal.md`** — what
was done and **why**, newest at the bottom, never corrected in place. Write it
as the last act of the session, not the first act of the next one.

The journal is the history of executing the build. Code says what the system
does now; the journal says what it used to do, what it cost to change, and
which beliefs turned out to be wrong. Nearly everything expensive to rediscover
lives there and nowhere else.

An entry is headed with the date, a short title, and where it landed:

```markdown
## 2026-09-04 — Both runway stages render their final frame without JS (#51, `ce46ae0`)
```

Then prose — not a bullet list of file names, which the diff already tells you.
What to put in, in rough order of value:

- **Why, over what.** The reason a thing was done survives; the diff does not
  need restating.
- **Measured numbers, exactly.** "The comp's open mask is 2696×2352 on an 860px
  band — 2.735× the band's height, so a 390×664 phone needs ~534%" is worth
  keeping. "Fixed the hero on mobile" is not.
- **Defects, named.** What broke, what it looked like, and what made it
  invisible until it wasn't.
- **What was tried and abandoned**, and what it would take to revive it. A dead
  end nobody wrote down gets walked twice.
- **Beliefs corrected on contact.** The design assumption that turned out false
  is usually the most valuable line in the entry.
- **Honest accounting.** If a win came from somewhere other than the change
  that claimed it, say so — that is exactly what someone will otherwise
  over-invest in next.

**History is never edited to be right.** An entry that stops being true is not
rewritten; a later entry corrects it, and says which one it corrects. The
journal is a record of what was believed at the time, and that record is most
useful precisely where it was wrong. Fixing the past in place destroys the only
evidence of how the mistake was made.

If a session produced nothing worth an entry, that is itself worth one line.
