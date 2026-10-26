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

## 2026-10-26 — SvelteKit 3 and adapter-node 6 (kit 3 migration PR)

Kit 2 → 3.1.0 and adapter-node 5 → 6.0.0, for GHSA-27mw-82g8-phjj. This supersedes Renovate's #22 (kit 3) and #16 (adapter-node 6). One PR into `main`, as the operator chose today for reddoor-starter-blux and canvas-starter. This repo's `CLAUDE.md` says nothing about `staging`, and the staging flow's machinery is Netlify's, which this Render service does not use. Render auto-deploys `main`, so the merge is the deploy.

The port is small, because this app uses almost none of kit's surface:

- `svelte.config.js` became `sveltekit.config.js`, passed to `sveltekit(kitConfig)`;
- `tsconfig` extends `$app/tsconfig`;
- the `$lib` alias is declared, because kit 3 no longer supplies it: without it svelte-check found 4 unresolved `$lib/server/*` imports in `api/generate`;
- the `json` helper is still exported in 3.1.0, so the endpoints are unchanged.

Belief corrected on contact: that the Docker image's Node would do. Kit 3.1.0's `engines` asks for Node >= 22.17. The Dockerfile pinned `node:22.13-slim` in both stages, and CI's `node-version: 22` resolves to a current 22.x, so CI would never have shown it. Both stages are now `node:22.22-slim`.

Measured. Lint, svelte-check (0/0), the build, and 26 unit tests pass, the renderer test included, with a real Chromium. Both builds were run with `node build` on Node 22.22 as the image runs them, head and `main` side by side. They return the same `/healthz`, and the same 2-page, 25,957-byte PDF for the same markdown. A bad body gets the same 400, and the page and 404 statuses match. The Playwright test passes with `PUPPETEER_EXECUTABLE_PATH` set. Without it, the dev server's renderer falls back to `/usr/bin/chromium`, which a cloud container lacks, so the test times out waiting for the download; that is the environment, not kit 3.

Round 1 of the review found that the migration had silently dropped the production CSRF fix from 2026-04-29. adapter-node 5 read `ORIGIN` from the environment at runtime, and `render.yaml` set it. adapter-node 6 no longer reads it; its origin is kit's `paths.origin`, fixed at build time, and otherwise the request's `Host` with `https`. So a form-encoded POST from `https://reddoor-md-pdf.onrender.com` to a server reached under another host answered 403 where it had been let through. It had no effect today, because the UI posts JSON, which kit's CSRF check skips, and behind Render `Host` is the public hostname. `paths.origin` now carries the same URL, and the dead `ORIGIN` entry is gone from `render.yaml`. The same three requests now behave as on `main`: the Render origin passes the CSRF check and gets the endpoint's own 400; a foreign origin with a matching `Host` gets 403; a JSON render is 200. The review also found a pre-existing 500 on any filename above U+00FF, equal on `main` (#26).
