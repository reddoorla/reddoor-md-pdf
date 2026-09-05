# Reddoor Markdown → PDF — Work Journal

Running log of build work: what was done, why, and where it landed.
Chronological — newest entry at the bottom. [README.md](../README.md) says what
the app is and how to run it; this is the history of getting it there.

The convention is in [CLAUDE.md](../CLAUDE.md) under "The work journal". In
short: every working session appends a dated entry, prose over bullets, why
over what, and history is never edited to be right — a later entry corrects an
earlier one and says so.

---

## 2026-09-05 — Journal opened, and 39 commits of history summarised rather than reconstructed (`chore/work-journal`)

The journal starts today, so this first entry is a **backfill**: a coarse
summary written from the commit log, not from memory. Detail below this line is
trustworthy; detail above it is not, and nothing here should be cited as though
someone wrote it down at the time. The commit log remains the record for
anything before 2026-09-05.

**What this repo is.** A single-page SvelteKit / Svelte 5 app on `adapter-node`:
paste markdown, get a Reddoor-branded PDF. `POST /api/generate` hands the body
to `md-to-pdf`, which drives a system Chromium through `puppeteer-core`, using
the page config lifted from `reddoor-starter`'s `export:rfp-pdf` so a hosted
paste and a local export produce the same document. It runs as a Docker image
on Render's free tier, deliberately single-tenant: no auth and no markdown
sanitisation, because whoever pastes is the only consumer of the result.

**Three eras, and only one of them is development.** Thirty-three of the
thirty-nine commits landed on **one day, 2026-04-29**: spec, scaffold, then
helper by helper — size cap, rate limiter, filename derivation, the
30s-timeout renderer, the endpoint — then a run of deploy-shaped fixes that were
the real cost of shipping it. `ORIGIN` set to stop a CSRF 403 in production,
corepack bypassed in the Dockerfile around a pnpm signing-key bug, and
`/healthz` demoted from a Chromium smoke-launch to a cheap 200 because Render's
health check would not pass while it did the real thing. That trade still
stands: the health check proves the process is up, not that it can render.

Then three months of silence and **one commit, 2026-07-21**, worth more than its
size: `h2 { break-before: page }` forced a break before every `##`, so documents
using `##` for subsections fragmented into near-empty pages — a 63-page export
collapsed to 28 once breaks keyed off `#`. A regression test in
`tests/unit/pdf-config.test.ts` is the only thing keeping that from drifting
back. **August–September 2026 is fleet maintenance**, not work here: Renovate
and CI onboarding with 24 Dependabot alerts cleared (#1), CI on `staging` (#4),
lockfile and a pnpm security bump (#5, #6).

**State as of this entry.** On `main` at `48bd336`, tree clean, **five commits
behind `origin/main` (`aa55487`)** — all five that maintenance work, so this
checkout has a stale lockfile and no `.github/` in it at all. This branch was
cut from the local tip and adds two files. No open PRs; the two stale local
branches are already contained in `origin/main`.
