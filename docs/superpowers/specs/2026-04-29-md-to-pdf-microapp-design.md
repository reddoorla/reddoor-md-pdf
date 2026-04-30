# Reddoor Markdown → PDF Micro App — Design

## Purpose

Extract the markdown→branded-PDF pipeline currently embedded in `reddoor-starter` (the `pdf.config.cjs` + `export:rfp-pdf` script used to generate `docs/rfp-handbook.pdf`) into a small standalone web app. Anyone with the URL can paste markdown or drop a `.md` file and download a Reddoor-branded PDF. The handbook content itself stays in `reddoor-starter`; only the rendering pipeline is reused.

## Non-goals

- Per-user theming or brand customization. The Reddoor look is baked in.
- Hosting the RFP handbook content. The source of the handbook stays in `reddoor-starter`.
- Authentication or accounts. Access is link-only with soft rate limiting.
- Live HTML preview. The textarea content is the preview; the PDF is the source of truth.
- A general-purpose CLI. The audience is anyone with the URL, not just devs.

## Architecture

- **Framework:** SvelteKit (matches the rest of the Reddoor stack).
- **Styling:** Tailwind CSS v4. The page UI uses the same Pragmatica/Besley fonts and `#424B5A` / `#6d6e71` / `#D71920` palette as the PDF, so the tool visually reads as a Reddoor utility.
- **Renderer:** `md-to-pdf` Node API, called with the existing `pdf.config.cjs` copied verbatim from `reddoor-starter`. PDF output is byte-for-byte the same as `pnpm export:rfp-pdf` produces today.
- **Container:** Single Dockerfile based on `node:22-slim`. System Chromium installed via `apt-get install chromium`. Puppeteer is configured with `PUPPETEER_SKIP_DOWNLOAD=1` and `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` so we ship one Chromium, not two.
- **Host:** Fly.io. Single small VM (256 MB RAM is enough for one render at a time; 512 MB gives headroom). Auto-stop when idle, auto-start on first request — sub-second wake. Render is an acceptable alternative if Fly setup hits friction.
- **Repo:** Standalone repo `reddoor-md-pdf`, sibling to `reddoor-starter`. Different lifecycle from the starter (a deployed app, not a forkable scaffold). The `pdf.config.cjs` is copied, not symlinked or shared as a package — drift is unlikely and a fresh copy keeps the new repo self-contained.

## Components

### Frontend (single page)

Single-column, max-width ~720px, centered. Mobile-first.

- Header: small Reddoor wordmark + page title "Markdown → PDF".
- One-line description: "Paste markdown or drop a `.md` file. Get a Reddoor-branded PDF."
- **Textarea-as-drop-target.** The textarea is itself the file drop zone — dropping a `.md` file fills the textarea with its contents (so users can edit before generating). Empty-state placeholder: "Paste your markdown here, or drop a .md file…"
- Optional filename input. Placeholder shows the auto-derived name (see Filename derivation below).
- Primary button "Generate PDF." Disabled while empty or in-flight; shows a spinner during render.
- Inline error region under the button surfaces server errors verbatim (`{ error: string }` from the API).

The textarea content is **never cleared on error.** Users do not lose work.

### API

One endpoint, `POST /api/generate`.

- **Request body (JSON):** `{ markdown: string, filename?: string }`. The file-drop path reads the `.md` client-side as text and posts the same JSON shape.
- **Response (success):** `200 OK` with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="<derived>.pdf"`.
- **Response (error):** `4xx`/`5xx` with JSON `{ error: string }` containing a human-readable message.

### Renderer module

Pure server-side function: `(markdown: string) => Promise<Buffer>`.

- Wraps `md-to-pdf` with the project's `pdf.config.cjs`.
- Uses the system Chromium via `PUPPETEER_EXECUTABLE_PATH`.
- Holds a single Puppeteer browser instance across requests (warm), with a re-launch on crash.
- Hard 30 s timeout per render; rejects with a renderer-timeout error.

### Filename derivation

If the user leaves the filename input blank:

1. Find the first `# Heading` in the markdown.
2. Slugify (lowercase, ASCII-only, hyphens for whitespace, strip everything else).
3. Truncate to 80 chars.
4. Append `.pdf`.
5. Fallback to `document.pdf` if no H1 or empty after slugifying.

If the user typed a filename, use it (sanitize for filesystem safety, append `.pdf` if missing).

### Soft gate

Three layers, all server-side:

- **Size cap.** `markdown` body capped at 1 MB (~175,000 words — comfortably more than any realistic Reddoor doc). Enforced before rendering. Exceeded → `413` with a clear message.
- **Rate limit.** 10 generations per IP per minute, in-memory token-bucket. A single Fly VM is the only process, so no Redis. Exceeded → `429` with `Retry-After`.
- **Render timeout.** 30 s on the Puppeteer call. Exceeded → `504`.

These are pulled-from-the-air defaults; reasonable to dial up or down post-launch.

## Data flow

1. User pastes markdown or drops a `.md` file. On drop, the file is read client-side as text and inserted into the textarea.
2. User optionally edits filename, clicks **Generate PDF.**
3. Browser POSTs `{ markdown, filename }` to `/api/generate` as JSON.
4. Server checks size cap, then rate limit.
5. Server passes the markdown through `md-to-pdf` with `pdf.config.cjs`, returning a `Buffer`.
6. Server returns the buffer with `application/pdf` content type and the derived filename.
7. Browser triggers a download.

## Error handling

| Condition                          | HTTP   | Body                              | UI shows                                    |
| ---------------------------------- | ------ | --------------------------------- | ------------------------------------------- |
| Body > 1 MB                        | 413    | `{ error: "Markdown too large." }` | Inline message under button                 |
| Rate limit hit                     | 429    | `{ error: "Too many requests." }`  | Inline + retry-after countdown              |
| Markdown parse failure             | 400    | `{ error: <parser msg> }`          | Inline message                              |
| Renderer timeout                   | 504    | `{ error: "Render timed out." }`   | Inline message, suggest retry               |
| Renderer crash                     | 502    | `{ error: "Renderer error." }`     | Inline message, suggest retry               |
| Chromium unhealthy on boot         | 503    | `{ error: "Service unavailable." }`| Inline message                              |
| Network error in browser           | —      | —                                 | Inline "Connection failed, please retry"   |

In all error paths, the textarea content remains intact.

## Testing

- **Unit (Vitest):**
  - `renderer.ts`: given fixture markdown, returns a `Buffer` whose first bytes are `%PDF-` and length > 1 KB. Test PDF output at the buffer level: assert PDF magic bytes (`%PDF-`) and a reasonable byte length. The actual markdown→HTML transformation is owned by `md-to-pdf` and not snapshotted directly.
  - `slugify` / filename derivation: pure-function tests including no-H1, unicode, and overlong-title edge cases.
  - Soft-gate helpers (size check, token-bucket): pure-function tests.
- **Integration (Playwright, one spec):** boot the app, paste a small markdown, click Generate, assert a PDF download fires and the byte stream starts with `%PDF-`. One happy path is enough.
- **Smoke on deploy:** `/healthz` endpoint spawns Chromium and returns `200 OK` if it's reachable; Fly health checks hit it. Catches "image built fine but Chromium can't launch" early.

## Open questions deferred to implementation

- Exact Tailwind tokens for the page UI (the PDF CSS lives in `pdf.config.cjs` and is server-only; the UI needs its own Tailwind theme that mirrors those colors/fonts).
- Whether to wire a "Copy permalink to filled-in markdown" button in v2. Out of scope for v1.
- Whether to publish a public README + favicon on the deployed app. Recommend yes, low effort.
