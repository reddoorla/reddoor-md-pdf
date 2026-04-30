# Reddoor Markdown → PDF Micro App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page SvelteKit app where anyone with the URL can paste markdown (or drop a `.md`) and download a Reddoor-branded PDF, deployed to Render.com (free tier) behind soft rate-limits.

**Architecture:** SvelteKit (node adapter) → `POST /api/generate` → server-side renderer that wraps `md-to-pdf` with the existing `pdf.config.cjs`, returning a PDF buffer. Soft gating (size cap, in-memory token-bucket rate limit, Puppeteer timeout) lives in the API handler. UI is a textarea-as-drop-target with an optional filename input. Container is `node:22-slim` + system Chromium.

**Tech Stack:** SvelteKit, TypeScript, Tailwind CSS v4, Vitest, Playwright, `md-to-pdf`, `puppeteer-core`, `marked` (for the snapshotted intermediate HTML helper), Render.com, Docker.

**Reference docs:**

- Spec: [`docs/superpowers/specs/2026-04-29-md-to-pdf-microapp-design.md`](../specs/2026-04-29-md-to-pdf-microapp-design.md)
- PDF style config (already committed): [`pdf.config.cjs`](../../../pdf.config.cjs)
- Fixture markdown: [`tests/fixtures/rfp-handbook.md`](../../../tests/fixtures/rfp-handbook.md)
- Brand assets: [`src/lib/assets/logos/`](../../../src/lib/assets/logos/) (`logoFull.svg`, `reddoor_logo.png`)

---

## File Structure

Created during this plan:

```text
package.json                            # pnpm deps + scripts
pnpm-lock.yaml                          # auto-generated
svelte.config.js                        # node adapter
vite.config.ts                          # vite + vitest + tailwind plugin
tsconfig.json                           # SvelteKit-shaped TS config
playwright.config.ts                    # one-spec smoke config
.dockerignore
Dockerfile                              # node:22-slim + chromium
render.yaml                             # Render.com Blueprint
README.md
static/favicon.svg

src/app.html                            # SvelteKit shell
src/app.css                             # Tailwind v4 entry + Reddoor theme tokens
src/routes/+layout.svelte               # global layout
src/routes/+page.svelte                 # main UI: textarea, filename input, button
src/routes/api/generate/+server.ts      # POST endpoint
src/routes/healthz/+server.ts           # GET health check (smoke-launches Chromium)

src/lib/server/renderer.ts              # md-to-pdf wrapper, browser launch, timeout
src/lib/server/markdown-to-html.ts      # pure: markdown → HTML string (snapshot target)
src/lib/server/filename.ts              # pure: slugify + filename derivation
src/lib/server/rate-limit.ts            # pure: token-bucket factory
src/lib/server/size-limit.ts            # pure: size-cap helper

tests/unit/markdown-to-html.test.ts
tests/unit/filename.test.ts
tests/unit/rate-limit.test.ts
tests/unit/size-limit.test.ts
tests/unit/renderer.test.ts
tests/integration/generate.spec.ts      # Playwright happy-path
```

Files already in the repo (do not recreate):

- `pdf.config.cjs`, `tests/fixtures/rfp-handbook.md`
- `src/lib/assets/logos/{logoFull.svg,reddoor_logo.png}`
- `.gitignore`, `.gitattributes`

---

## Conventions

- **Package manager:** `pnpm`. All commands assume `pnpm`.
- **TDD:** every behaviour-bearing module gets a failing test first, then the minimal code.
- **Commits:** one commit per task (after the task's tests pass). Use Conventional Commits: `feat:`, `test:`, `chore:`, `docs:`.
- **Imports of `pdf.config.cjs`:** Node `require()` from server code. SvelteKit + Vite handle CJS in server-only modules; `src/lib/server/**` is server-only by SvelteKit convention.
- **Headless Chromium path:** server reads `PUPPETEER_EXECUTABLE_PATH`, falls back to `/usr/bin/chromium` (matches the Dockerfile).

---

## Task 1: Scaffold SvelteKit + TypeScript

**Files:**

- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`

- [ ] **Step 1: Initialise pnpm project**

Run from the repo root:

```bash
pnpm init
```

Then replace the generated `package.json` with:

```json
{
  "name": "reddoor-md-pdf",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install SvelteKit + Vite + TS**

```bash
pnpm add -D @sveltejs/kit @sveltejs/adapter-node @sveltejs/vite-plugin-svelte svelte svelte-check typescript vite tslib
```

- [ ] **Step 3: Create `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build' })
  }
};
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node'
  }
});
```

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 6: Create `src/app.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.svg" type="image/svg+xml" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reddoor · Markdown → PDF</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 7: Create placeholder `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

{@render children?.()}
```

- [ ] **Step 8: Create placeholder `src/routes/+page.svelte`**

```svelte
<h1>Reddoor · Markdown → PDF</h1>
<p>Scaffold complete. UI lands in Task 8.</p>
```

- [ ] **Step 9: Create empty `src/app.css`** (Tailwind lands in Task 2)

```css
/* Tailwind entry — populated in Task 2. */
```

- [ ] **Step 10: Run dev server, verify it boots**

Run `pnpm dev` (in a separate terminal or `&`). Expected: prints `Local: http://localhost:5173`. Visit URL → see the placeholder heading. Stop the dev server.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-lock.yaml svelte.config.js vite.config.ts tsconfig.json src/app.html src/app.css src/routes/+layout.svelte src/routes/+page.svelte
git commit -m "chore: scaffold SvelteKit + TypeScript"
```

---

## Task 2: Wire Tailwind v4 with Reddoor theme tokens

**Files:**

- Modify: `vite.config.ts`, `src/app.css`, `src/routes/+page.svelte`

- [ ] **Step 1: Install Tailwind v4 + Vite plugin**

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Add Tailwind plugin to `vite.config.ts`**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node'
  }
});
```

- [ ] **Step 3: Replace `src/app.css` with Tailwind entry + Reddoor tokens**

Theme values mirror `pdf.config.cjs` so the UI reads as the same brand surface as the PDF.

```css
@import "tailwindcss";

@theme {
  --color-rd-dark: #424B5A;
  --color-rd-body: #6d6e71;
  --color-rd-red: #D71920;
  --color-rd-light: #BBBDBF;
  --color-rd-bg: #ffffff;
  --color-rd-surface: #f5f5f5;

  --font-sans: "pragmatica", "Helvetica Neue", Helvetica, "Segoe UI", system-ui, sans-serif;
  --font-serif: "Besley", Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

html, body {
  background: var(--color-rd-bg);
  color: var(--color-rd-body);
  font-family: var(--font-sans);
}

@font-face {
  /* Pragmatica via Adobe — same source as pdf.config.cjs */
  /* Loaded via stylesheet link in Task 8 to avoid blocking the SSR pass */
}
```

- [ ] **Step 4: Smoke-test Tailwind in `src/routes/+page.svelte`**

```svelte
<div class="mx-auto max-w-3xl px-6 py-12">
  <h1 class="text-3xl text-rd-dark">Reddoor · Markdown → PDF</h1>
  <p class="mt-2 text-rd-body">Tailwind wired. UI lands in Task 8.</p>
</div>
```

- [ ] **Step 5: Boot dev server, verify styles**

Run `pnpm dev`. Visit `http://localhost:5173`. Expected: heading is rendered in the Reddoor dark colour with Helvetica/system font stack, `max-w-3xl` centring works. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts src/app.css src/routes/+page.svelte
git commit -m "chore: wire Tailwind v4 with Reddoor theme tokens"
```

---

## Task 3: Filename derivation (pure function, TDD)

**Files:**

- Create: `src/lib/server/filename.ts`
- Test: `tests/unit/filename.test.ts`

The derivation rules are spelled out in the spec under **Filename derivation**.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/filename.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveFilename } from '../../src/lib/server/filename';

describe('deriveFilename', () => {
  it('returns sanitized user input with .pdf appended when caller provides a filename', () => {
    expect(deriveFilename('My Doc', '# Ignored')).toBe('My Doc.pdf');
  });

  it('preserves a user-supplied .pdf extension', () => {
    expect(deriveFilename('report.pdf', '# Ignored')).toBe('report.pdf');
  });

  it('strips path separators and Windows-illegal chars but keeps spaces', () => {
    expect(deriveFilename('a/b\\c:d*e?f"g<h>i|j', '# Ignored')).toBe('abcdefghij.pdf');
  });

  it('preserves spaces inside user-supplied filenames', () => {
    expect(deriveFilename('Quarterly  Report', '# Ignored')).toBe('Quarterly  Report.pdf');
  });

  it('falls back to the first H1 slugified when no filename supplied', () => {
    expect(deriveFilename(undefined, '# Reddoor RFP Handbook\n\ncontent')).toBe(
      'reddoor-rfp-handbook.pdf'
    );
  });

  it('lowercases and ASCII-normalises unicode in the H1', () => {
    expect(deriveFilename(undefined, '# Café Résumé — V2')).toBe('cafe-resume-v2.pdf');
  });

  it('truncates derived names to 80 chars before the extension', () => {
    const longTitle = 'a '.repeat(100).trim();
    const out = deriveFilename(undefined, `# ${longTitle}`);
    expect(out.endsWith('.pdf')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(84); // 80 + '.pdf'
  });

  it('falls back to document.pdf when there is no H1', () => {
    expect(deriveFilename(undefined, 'no heading here')).toBe('document.pdf');
  });

  it('falls back to document.pdf when the H1 slugifies to empty', () => {
    expect(deriveFilename(undefined, '# !!!')).toBe('document.pdf');
  });

  it('treats an empty user filename string as "not provided"', () => {
    expect(deriveFilename('', '# Hello World')).toBe('hello-world.pdf');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/unit/filename.test.ts
```

Expected: FAIL with module-not-found for `src/lib/server/filename`.

- [ ] **Step 3: Implement `src/lib/server/filename.ts`**

```ts
const MAX_DERIVED_LENGTH = 80;

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeUserFilename(name: string): string {
  const stripped = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim();
  if (!stripped) return '';
  return stripped.toLowerCase().endsWith('.pdf') ? stripped : `${stripped}.pdf`;
}

function firstH1(markdown: string): string | null {
  const match = markdown.match(/^\s*#\s+(.+?)\s*$/m);
  return match ? match[1] : null;
}

export function deriveFilename(userInput: string | undefined, markdown: string): string {
  if (userInput && userInput.trim()) {
    const sanitized = sanitizeUserFilename(userInput);
    if (sanitized) return sanitized;
  }

  const heading = firstH1(markdown);
  if (heading) {
    const slug = slugify(heading).slice(0, MAX_DERIVED_LENGTH);
    if (slug) return `${slug}.pdf`;
  }

  return 'document.pdf';
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/unit/filename.test.ts
```

Expected: 10/10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/filename.ts tests/unit/filename.test.ts
git commit -m "feat: filename derivation from user input or markdown H1"
```

---

## Task 4: Size-limit helper (pure function, TDD)

**Files:**

- Create: `src/lib/server/size-limit.ts`
- Test: `tests/unit/size-limit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/size-limit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_MARKDOWN_BYTES, exceedsMarkdownLimit } from '../../src/lib/server/size-limit';

describe('size-limit', () => {
  it('exposes a 1 MB cap', () => {
    expect(MAX_MARKDOWN_BYTES).toBe(1024 * 1024);
  });

  it('returns false for a small ASCII string', () => {
    expect(exceedsMarkdownLimit('hello')).toBe(false);
  });

  it('returns false at exactly the limit', () => {
    const atLimit = 'a'.repeat(MAX_MARKDOWN_BYTES);
    expect(exceedsMarkdownLimit(atLimit)).toBe(false);
  });

  it('returns true at limit + 1 byte', () => {
    const overLimit = 'a'.repeat(MAX_MARKDOWN_BYTES + 1);
    expect(exceedsMarkdownLimit(overLimit)).toBe(true);
  });

  it('measures bytes (UTF-8), not characters', () => {
    // '🔴' = 4 UTF-8 bytes; 300_000 of them = 1_200_000 bytes > 1 MB
    const heavy = '🔴'.repeat(300_000);
    expect(exceedsMarkdownLimit(heavy)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/unit/size-limit.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `src/lib/server/size-limit.ts`**

```ts
export const MAX_MARKDOWN_BYTES = 1024 * 1024;

export function exceedsMarkdownLimit(markdown: string): boolean {
  return Buffer.byteLength(markdown, 'utf-8') > MAX_MARKDOWN_BYTES;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/unit/size-limit.test.ts
```

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/size-limit.ts tests/unit/size-limit.test.ts
git commit -m "feat: 1 MB markdown size cap helper"
```

---

## Task 5: Token-bucket rate limiter (pure factory, TDD)

**Files:**

- Create: `src/lib/server/rate-limit.ts`
- Test: `tests/unit/rate-limit.test.ts`

In-memory token bucket, keyed by client IP. Single Render web service = one process, so no Redis. Default: 10 requests per IP per minute.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/rate-limit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../src/lib/server/rate-limit';

describe('createRateLimiter', () => {
  it('allows requests up to the capacity', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 3, refillIntervalMs: 60_000, now: () => now });

    expect(limiter.take('1.1.1.1')).toEqual({ allowed: true });
    expect(limiter.take('1.1.1.1')).toEqual({ allowed: true });
    expect(limiter.take('1.1.1.1')).toEqual({ allowed: true });
  });

  it('rejects the next request and reports retryAfterMs', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 2, refillIntervalMs: 60_000, now: () => now });

    limiter.take('1.1.1.1');
    limiter.take('1.1.1.1');

    const result = limiter.take('1.1.1.1');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it('refills one token per interval/capacity step', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 2, refillIntervalMs: 60_000, now: () => now });

    limiter.take('1.1.1.1');
    limiter.take('1.1.1.1');
    expect(limiter.take('1.1.1.1').allowed).toBe(false);

    now += 30_000; // half an interval -> one token back for capacity 2
    expect(limiter.take('1.1.1.1').allowed).toBe(true);
    expect(limiter.take('1.1.1.1').allowed).toBe(false);
  });

  it('keeps separate buckets per key', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 1, refillIntervalMs: 60_000, now: () => now });

    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('b').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
  });

  it('caps tokens at capacity even after long idle', () => {
    let now = 0;
    const limiter = createRateLimiter({ capacity: 2, refillIntervalMs: 60_000, now: () => now });

    limiter.take('a');
    limiter.take('a');
    now += 10 * 60_000;

    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm test tests/unit/rate-limit.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `src/lib/server/rate-limit.ts`**

```ts
export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export type RateLimiterOptions = {
  capacity: number;
  refillIntervalMs: number;
  now?: () => number;
};

type Bucket = { tokens: number; updatedAt: number };

export function createRateLimiter(opts: RateLimiterOptions) {
  const now = opts.now ?? (() => Date.now());
  const refillPerMs = opts.capacity / opts.refillIntervalMs;
  const buckets = new Map<string, Bucket>();

  function refill(bucket: Bucket, t: number): Bucket {
    const elapsed = t - bucket.updatedAt;
    const refilled = Math.min(opts.capacity, bucket.tokens + elapsed * refillPerMs);
    return { tokens: refilled, updatedAt: t };
  }

  function take(key: string): RateLimitResult {
    const t = now();
    const current = buckets.get(key) ?? { tokens: opts.capacity, updatedAt: t };
    const refilled = refill(current, t);

    if (refilled.tokens >= 1) {
      buckets.set(key, { tokens: refilled.tokens - 1, updatedAt: t });
      return { allowed: true };
    }

    buckets.set(key, refilled);
    const tokensNeeded = 1 - refilled.tokens;
    const retryAfterMs = Math.ceil(tokensNeeded / refillPerMs);
    return { allowed: false, retryAfterMs };
  }

  return { take };
}

export const DEFAULT_RATE_LIMIT = {
  capacity: 10,
  refillIntervalMs: 60_000
};
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
pnpm test tests/unit/rate-limit.test.ts
```

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/rate-limit.ts tests/unit/rate-limit.test.ts
git commit -m "feat: in-memory token-bucket rate limiter"
```

---

## Task 6: Markdown → HTML helper (pure, TDD with snapshots)

**Files:**

- Create: `src/lib/server/markdown-to-html.ts`
- Test: `tests/unit/markdown-to-html.test.ts`

Per the spec, fixtures are snapshotted at the **HTML** layer (not at the PDF byte layer). This module produces the HTML that the renderer feeds to Chromium, mirroring `md-to-pdf`'s shape (CSS from `pdf.config.cjs` injected into a `<style>` tag, body wrapped in a `markdown-body` class).

- [ ] **Step 1: Install marked**

```bash
pnpm add marked
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/markdown-to-html.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../../src/lib/server/markdown-to-html';

describe('markdownToHtml', () => {
  it('wraps body in markdown-body class', () => {
    const html = markdownToHtml('# hello');
    expect(html).toContain('<body class="markdown-body">');
  });

  it('inlines CSS from pdf.config.cjs into a <style> tag', () => {
    const html = markdownToHtml('# hello');
    expect(html).toMatch(/<style>[\s\S]*color:\s*#6d6e71/);
  });

  it('renders heading-only fixture deterministically', () => {
    expect(markdownToHtml('# Reddoor RFP Handbook')).toMatchSnapshot();
  });

  it('renders a table fixture deterministically', () => {
    const md = [
      '| col a | col b |',
      '| ----- | ----- |',
      '| one   | two   |'
    ].join('\n');
    expect(markdownToHtml(md)).toMatchSnapshot();
  });

  it('renders a link fixture deterministically', () => {
    expect(markdownToHtml('See [Reddoor](https://reddoor.com).')).toMatchSnapshot();
  });

  it('renders a fenced code block fixture deterministically', () => {
    const md = '```js\nconst x = 1;\n```\n';
    expect(markdownToHtml(md)).toMatchSnapshot();
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

```bash
pnpm test tests/unit/markdown-to-html.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 4: Add a TypeScript declaration so the `.cjs` import is typed**

Create `src/lib/server/pdf-config.d.ts`:

```ts
declare module '*/pdf.config.cjs' {
  const config: {
    css: string;
    pdf_options: Record<string, unknown>;
  };
  export default config;
}
```

- [ ] **Step 5: Implement `src/lib/server/markdown-to-html.ts`**

Vite bundles the `.cjs` config into the server output via static `import`. Avoid `createRequire(import.meta.url)` here — after build, `import.meta.url` resolves to the bundled file location, not the source, and the relative path breaks.

```ts
import { marked } from 'marked';
import pdfConfig from '../../../pdf.config.cjs';

export function markdownToHtml(markdown: string): string {
  const body = marked.parse(markdown, { async: false }) as string;
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<style>${pdfConfig.css}</style>`,
    '</head>',
    '<body class="markdown-body">',
    body,
    '</body>',
    '</html>'
  ].join('\n');
}
```

- [ ] **Step 6: Run tests, accept the new snapshots**

```bash
pnpm test tests/unit/markdown-to-html.test.ts
```

The snapshot tests write `tests/unit/__snapshots__/markdown-to-html.test.ts.snap` on first run. Inspect the snapshot file once — confirm it contains expected `<h1>`, `<table>`, `<a href="…">`, `<pre><code class="…js">…</code></pre>` shapes — then accept by leaving the file as-is. Re-run to confirm green.

```bash
pnpm test tests/unit/markdown-to-html.test.ts
```

Expected: 6/6 pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/markdown-to-html.ts src/lib/server/pdf-config.d.ts tests/unit/markdown-to-html.test.ts tests/unit/__snapshots__/markdown-to-html.test.ts.snap package.json pnpm-lock.yaml
git commit -m "feat: markdown→HTML helper with style snapshot fixtures"
```

---

## Task 7: Renderer module (md-to-pdf wrapper, TDD)

**Files:**

- Create: `src/lib/server/renderer.ts`
- Test: `tests/unit/renderer.test.ts`

The renderer takes markdown, returns a PDF `Buffer`. It calls `md-to-pdf` with `pdf.config.cjs` and a `launch_options.executablePath` so puppeteer uses the system Chromium installed in the Dockerfile. A 30 s timeout wraps the call. Errors surface as typed sub-classes so the API handler can map them to HTTP codes.

**Note on browser warmth:** The spec mentions holding a single Puppeteer browser instance across requests. `md-to-pdf` v5 does not expose a public hook for an existing browser, so v1 launches one per request. With system Chromium this is ~1–2 s of overhead, acceptable for a human-paced tool. If render times measure above ~3 s in production, swap to a direct `puppeteer-core` + `markdown-to-html.ts` pipeline (Task 6 already provides the HTML).

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add md-to-pdf puppeteer-core
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/renderer.test.ts`. The renderer test is **gated**: it only runs when a Chromium binary is available. CI/Docker will have one; a fresh local checkout may not.

```ts
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RendererTimeoutError,
  renderMarkdownToPdf
} from '../../src/lib/server/renderer';

const chromiumPath =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : null) ??
  (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : null);

const skipIfNoChromium = chromiumPath ? describe : describe.skip;

skipIfNoChromium('renderMarkdownToPdf', () => {
  it('returns a buffer that begins with %PDF- and is > 1 KB', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath!;
    const buf = await renderMarkdownToPdf('# Hello\n\nSome body text.');
    expect(buf.length).toBeGreaterThan(1024);
    expect(buf.slice(0, 5).toString('utf-8')).toBe('%PDF-');
  }, 30_000);

  it('rejects with RendererTimeoutError when the deadline is exceeded', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath!;
    await expect(
      renderMarkdownToPdf('# tiny doc', { timeoutMs: 1 })
    ).rejects.toBeInstanceOf(RendererTimeoutError);
  }, 10_000);
});
```

- [ ] **Step 3: Run the test, verify it fails**

```bash
pnpm test tests/unit/renderer.test.ts
```

Expected: FAIL with module-not-found (or skipped if no Chromium present — that's fine, we'll still see the import error first).

- [ ] **Step 4: Implement `src/lib/server/renderer.ts`**

The `pdf-config.d.ts` declaration from Task 6 covers the typing for this static import.

```ts
import { mdToPdf } from 'md-to-pdf';
import pdfConfig from '../../../pdf.config.cjs';

export class RendererTimeoutError extends Error {
  constructor(message = 'Render timed out.') {
    super(message);
    this.name = 'RendererTimeoutError';
  }
}

export class RendererError extends Error {
  constructor(message = 'Renderer error.', readonly cause?: unknown) {
    super(message);
    this.name = 'RendererError';
  }
}

export type RenderOptions = { timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CHROMIUM = '/usr/bin/chromium';

export async function renderMarkdownToPdf(
  markdown: string,
  opts: RenderOptions = {}
): Promise<Buffer> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ?? DEFAULT_CHROMIUM;

  const renderPromise = (async () => {
    try {
      const result = await mdToPdf(
        { content: markdown },
        {
          ...pdfConfig,
          launch_options: {
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        } as never
      );
      if (!result || !result.content) {
        throw new RendererError('Renderer produced no output.');
      }
      return Buffer.from(result.content);
    } catch (err) {
      if (err instanceof RendererError) throw err;
      throw new RendererError('Renderer error.', err);
    }
  })();

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RendererTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([renderPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
```

- [ ] **Step 5: Run the tests, verify they pass (or skip)**

```bash
pnpm test tests/unit/renderer.test.ts
```

Expected: with Chromium present, 2/2 PASS in ~5–10 s. Without Chromium, both tests skip — that's acceptable locally; CI will run them.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/renderer.ts tests/unit/renderer.test.ts package.json pnpm-lock.yaml
git commit -m "feat: PDF renderer wrapping md-to-pdf with 30s timeout"
```

---

## Task 8: API endpoint `POST /api/generate`

**Files:**

- Create: `src/routes/api/generate/+server.ts`

This wires the helpers together. It is intentionally thin: parse JSON, check size, check rate, render, respond. The rate limiter is module-scoped so it survives across requests within the single Render service process.

- [ ] **Step 1: Implement the endpoint**

```ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deriveFilename } from '$lib/server/filename';
import { exceedsMarkdownLimit } from '$lib/server/size-limit';
import { DEFAULT_RATE_LIMIT, createRateLimiter } from '$lib/server/rate-limit';
import {
  RendererError,
  RendererTimeoutError,
  renderMarkdownToPdf
} from '$lib/server/renderer';

const limiter = createRateLimiter(DEFAULT_RATE_LIMIT);

function clientIp(request: Request, getClientAddress: () => string): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  try {
    return getClientAddress();
  } catch {
    return 'unknown';
  }
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as Record<string, unknown>).markdown !== 'string'
  ) {
    return json({ error: 'Field "markdown" must be a string.' }, { status: 400 });
  }

  const { markdown, filename } = body as { markdown: string; filename?: string };

  if (exceedsMarkdownLimit(markdown)) {
    return json({ error: 'Markdown too large.' }, { status: 413 });
  }

  const ip = clientIp(request, getClientAddress);
  const limit = limiter.take(ip);
  if (!limit.allowed) {
    const retrySec = Math.ceil(limit.retryAfterMs / 1000);
    return json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(retrySec) } }
    );
  }

  try {
    const pdf = await renderMarkdownToPdf(markdown);
    const out = deriveFilename(filename, markdown);
    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${out}"`,
        'Content-Length': String(pdf.length)
      }
    });
  } catch (err) {
    if (err instanceof RendererTimeoutError) {
      return json({ error: 'Render timed out.' }, { status: 504 });
    }
    if (err instanceof RendererError) {
      return json({ error: 'Renderer error.' }, { status: 502 });
    }
    throw error(500, 'Unexpected error.');
  }
};
```

- [ ] **Step 2: Smoke-test with curl**

Boot the dev server: `pnpm dev`. In another terminal:

```bash
curl -s -o /tmp/test.pdf -w "%{http_code}\n" \
  -X POST http://localhost:5173/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# Smoke Test\n\nHello world."}'

file /tmp/test.pdf
```

Expected: prints `200`, then `/tmp/test.pdf: PDF document, version 1.4 …` (or similar). Stop the dev server.

- [ ] **Step 3: Smoke-test the size cap**

```bash
python3 -c "import json; print(json.dumps({'markdown': 'x' * (1024*1024 + 1)}))" > /tmp/big.json

curl -s -w "\n%{http_code}\n" \
  -X POST http://localhost:5173/api/generate \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/big.json
```

Expected: `{"error":"Markdown too large."}` then `413`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/generate/+server.ts
git commit -m "feat: POST /api/generate endpoint with soft gating"
```

---

## Task 9: Healthz endpoint

**Files:**

- Create: `src/routes/healthz/+server.ts`

The smoke check launches Chromium briefly (with the same path the renderer uses) and returns 200 if it succeeds. Render's health check hits this endpoint.

- [ ] **Step 1: Implement the endpoint**

```ts
import { json } from '@sveltejs/kit';
import puppeteer from 'puppeteer-core';
import type { RequestHandler } from './$types';

const DEFAULT_CHROMIUM = '/usr/bin/chromium';

export const GET: RequestHandler = async () => {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ?? DEFAULT_CHROMIUM;
  try {
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    await browser.close();
    return json({ status: 'ok' });
  } catch (err) {
    return json(
      { status: 'unavailable', detail: (err as Error).message },
      { status: 503 }
    );
  }
};
```

- [ ] **Step 2: Smoke-test**

```bash
pnpm dev &
sleep 2
curl -s http://localhost:5173/healthz
kill %1
```

Expected: `{"status":"ok"}` (when Chromium is reachable). Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/routes/healthz/+server.ts
git commit -m "feat: /healthz endpoint that smoke-launches Chromium"
```

---

## Task 10: Frontend UI (textarea-as-drop-target, filename input, generate button)

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/app.css` (add web font links)

UI matches the spec: single column, max-width ~720px, mobile-first, textarea is the drop zone, filename optional, error region under the button. The textarea content is **never cleared on error**.

- [ ] **Step 1: Add the web fonts to `src/app.css`**

Append to `src/app.css`:

```css
@import url('https://use.typekit.net/alh8out.css');
@import url('https://fonts.googleapis.com/css2?family=Besley:wght@300;400;600&display=swap');
```

Move these to the top of the file so they fire before Tailwind's reset, replacing the prior `@import "tailwindcss";` order:

```css
@import url('https://use.typekit.net/alh8out.css');
@import url('https://fonts.googleapis.com/css2?family=Besley:wght@300;400;600&display=swap');
@import "tailwindcss";
```

- [ ] **Step 2: Replace `src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import logoUrl from '$lib/assets/logos/logoFull.svg';

  let markdown = $state('');
  let filename = $state('');
  let busy = $state(false);
  let errorMsg = $state<string | null>(null);

  function placeholderName(md: string): string {
    const m = md.match(/^\s*#\s+(.+?)\s*$/m);
    if (!m) return 'document.pdf';
    const slug = m[1]
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);
    return slug ? `${slug}.pdf` : 'document.pdf';
  }

  async function readDroppedFile(file: File): Promise<string> {
    return await file.text();
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!/\.md$|\.markdown$/i.test(file.name)) {
      errorMsg = 'Drop a .md or .markdown file.';
      return;
    }
    markdown = await readDroppedFile(file);
    errorMsg = null;
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  async function generate() {
    if (!markdown.trim() || busy) return;
    busy = true;
    errorMsg = null;
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, filename: filename || undefined })
      });

      if (!res.ok) {
        let msg = 'Connection failed, please retry.';
        try {
          const data = await res.json();
          if (typeof data?.error === 'string') msg = data.error;
        } catch {
          /* response was not JSON; keep default */
        }
        errorMsg = msg;
        return;
      }

      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(dispo);
      const name = match?.[1] ?? 'document.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      errorMsg = 'Connection failed, please retry.';
    } finally {
      busy = false;
    }
  }
</script>

<main class="mx-auto flex min-h-screen max-w-[720px] flex-col gap-6 px-6 py-10">
  <header class="flex items-center gap-3">
    <img src={logoUrl} alt="Reddoor" class="h-7 w-auto" />
    <h1 class="text-2xl text-rd-dark">Markdown → PDF</h1>
  </header>

  <p class="text-sm text-rd-body">
    Paste markdown or drop a <code class="rounded bg-rd-surface px-1 py-0.5">.md</code> file. Get a Reddoor-branded PDF.
  </p>

  <textarea
    bind:value={markdown}
    ondrop={onDrop}
    ondragover={onDragOver}
    placeholder="Paste your markdown here, or drop a .md file…"
    class="min-h-[360px] w-full rounded border border-rd-light bg-white p-4 font-mono text-sm text-rd-dark outline-none focus:border-rd-red"
  ></textarea>

  <label class="flex flex-col gap-1 text-sm text-rd-body">
    <span>Filename (optional)</span>
    <input
      type="text"
      bind:value={filename}
      placeholder={placeholderName(markdown)}
      class="w-full rounded border border-rd-light bg-white px-3 py-2 text-rd-dark outline-none focus:border-rd-red"
    />
  </label>

  <button
    type="button"
    onclick={generate}
    disabled={busy || !markdown.trim()}
    class="rounded bg-rd-red px-4 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
  >
    {busy ? 'Generating…' : 'Generate PDF'}
  </button>

  {#if errorMsg}
    <p class="rounded border border-rd-red/40 bg-rd-red/5 px-3 py-2 text-sm text-rd-red">
      {errorMsg}
    </p>
  {/if}
</main>
```

- [ ] **Step 3: Manually test the happy path in a browser**

Run `pnpm dev`. Visit `http://localhost:5173`. Paste a small markdown (`# Test\n\nHello.`), click **Generate PDF.** Expected: a `test.pdf` downloads, opens cleanly, shows the Reddoor styling.

- [ ] **Step 4: Manually test the drop path**

Drag `tests/fixtures/rfp-handbook.md` onto the textarea. Expected: textarea fills with the fixture contents. The filename placeholder updates to a slug derived from the H1.

- [ ] **Step 5: Manually test the size-cap error path**

In the textarea, paste a > 1 MB blob (browser DevTools console: `document.querySelector('textarea').value = 'a'.repeat(1_100_000); document.querySelector('textarea').dispatchEvent(new Event('input'))`). Click Generate. Expected: inline message `Markdown too large.` appears under the button; **textarea content is intact**.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+page.svelte src/app.css
git commit -m "feat: textarea-as-drop-target UI with Reddoor styling"
```

---

## Task 11: Playwright happy-path smoke

**Files:**

- Create: `playwright.config.ts`, `tests/integration/generate.spec.ts`

One spec, one path: load page → fill textarea → click button → assert a PDF download fires whose first bytes are `%PDF-`.

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/integration',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
```

- [ ] **Step 3: Create `tests/integration/generate.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('generates a PDF from pasted markdown', async ({ page }) => {
  await page.goto('/');

  await page.locator('textarea').fill('# Playwright Smoke\n\nHello PDF.');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /generate pdf/i }).click();
  const download = await downloadPromise;

  const tmp = await download.path();
  expect(tmp).toBeTruthy();
  const bytes = readFileSync(tmp!);
  expect(bytes.length).toBeGreaterThan(1024);
  expect(bytes.slice(0, 5).toString('utf-8')).toBe('%PDF-');
});
```

- [ ] **Step 4: Run the spec**

```bash
pnpm test:e2e
```

Expected: 1/1 PASS in ~10–15 s. (Requires the dev server's renderer to reach a Chromium binary; on macOS it falls back to the path checked in Task 7's test.)

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/integration/generate.spec.ts package.json pnpm-lock.yaml
git commit -m "test: playwright happy-path smoke for /api/generate"
```

---

## Task 12: Dockerfile (`node:22-slim` + system Chromium)

**Files:**

- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```text
node_modules
.svelte-kit
build
.git
.gitignore
docs
tests
*.md
.DS_Store
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM node:22-slim AS builder
WORKDIR /app

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PUPPETEER_SKIP_DOWNLOAD=1

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        ca-certificates \
        fonts-liberation \
        fonts-dejavu-core \
        libnss3 \
        libatk-bridge2.0-0 \
        libxkbcommon0 \
        libgbm1 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libxshmfence1 \
        libcups2 \
        libdrm2 \
        libpango-1.0-0 \
        libcairo2 \
        libasound2 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/build ./build

EXPOSE 8080
CMD ["node", "build"]
```

- [ ] **Step 3: Build the image locally**

```bash
docker build -t reddoor-md-pdf:dev .
```

Expected: build succeeds in ~2–4 min on first run.

- [ ] **Step 4: Run and smoke-test**

```bash
docker run --rm -p 8080:8080 reddoor-md-pdf:dev &
sleep 5
curl -s http://localhost:8080/healthz
```

Expected: `{"status":"ok"}`.

Then test render:

```bash
curl -s -o /tmp/docker.pdf -w "%{http_code}\n" \
  -X POST http://localhost:8080/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# Docker Smoke\n\nFrom container."}'
file /tmp/docker.pdf
```

Expected: `200`, then `PDF document, …`.

Stop the container:

```bash
docker ps -q --filter ancestor=reddoor-md-pdf:dev | xargs -r docker stop
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: dockerfile with node:22-slim and system chromium"
```

---

## Task 13: Render.com config

**Files:**

- Create: `render.yaml`

Render's free tier spins the service down after 15 min idle (~50 s cold-start on the next request) and gives 512 MB RAM, which is tight for Chromium but workable for one render at a time. The free tier is the reason for picking Render over Fly here. Deploy itself is a user action (connect the GitHub repo in the Render dashboard once; subsequent pushes auto-deploy).

Render injects its own `PORT` env var; the SvelteKit Node adapter respects `process.env.PORT` automatically, so we don't set it here. The Dockerfile's `EXPOSE 8080` and `PORT=8080` default still work for local Docker runs.

The three additional env vars wire SvelteKit's adapter-node to Render's proxy correctly:

- `BODY_SIZE_LIMIT=2097152` (2 MB) — adapter-node defaults to 512 KB, which is below the app's 1 MB markdown cap. Without this, oversized requests are killed by the framework with a non-JSON `Payload Too Large` response before the handler can return its `{"error":"Markdown too large."}` shape.
- `ADDRESS_HEADER=x-forwarded-for` + `XFF_DEPTH=1` — tells `getClientAddress()` to extract the rightmost-but-one entry from the `X-Forwarded-For` header, which is the actual client IP behind Render's single-hop proxy. Without these, `getClientAddress()` returns the proxy's IP (every request shares one bucket) or, with naive XFF parsing, the leftmost (attacker-controllable) value.

- [ ] **Step 1: Create `render.yaml`**

```yaml
services:
  - type: web
    name: reddoor-md-pdf
    runtime: docker
    region: ohio
    plan: free
    healthCheckPath: /healthz
    autoDeploy: true
    envVars:
      - key: PUPPETEER_SKIP_DOWNLOAD
        value: "1"
      - key: PUPPETEER_EXECUTABLE_PATH
        value: /usr/bin/chromium
      - key: NODE_ENV
        value: production
      - key: BODY_SIZE_LIMIT
        value: "2097152"
      - key: ADDRESS_HEADER
        value: x-forwarded-for
      - key: XFF_DEPTH
        value: "1"
```

- [ ] **Step 2: Commit (deploy is a separate user action)**

```bash
git add render.yaml
git commit -m "chore: render.com blueprint config"
```

Deploy flow:

1. Push to GitHub (covered in Task 15).
2. In the Render dashboard, **New → Blueprint** → connect the `reddoor-md-pdf` repo. Render reads `render.yaml`, provisions the free web service, and auto-deploys on subsequent pushes.
3. First boot pulls the Docker image and runs `node build`. Health check polls `/healthz` until it returns `200`.

---

## Task 14: README + favicon

**Files:**

- Create: `README.md`, `static/favicon.svg`

- [ ] **Step 1: Create `static/favicon.svg`**

A minimal red-square favicon that nods at the brand. The repo already has `src/lib/assets/logos/reddoor_logo.png` and `logoFull.svg` for the UI; the favicon stays simple.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#D71920" />
  <path d="M9 22 V10 H16 a4 4 0 0 1 0 8 L20 22 Z" fill="white" />
</svg>
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Reddoor Markdown → PDF

A tiny SvelteKit app: paste markdown, get a Reddoor-branded PDF.

The renderer is the same `pdf.config.cjs` used by `reddoor-starter`'s `pnpm export:rfp-pdf`, lifted into a hosted form so anyone with the URL can use it.

## Develop

    pnpm install
    pnpm dev

Visit http://localhost:5173.

## Test

    pnpm test          # vitest unit
    pnpm test:e2e      # playwright happy path

## Deploy

Hosted on Render.com (free tier). Connect this repo as a Blueprint in the Render dashboard once; subsequent pushes to `main` auto-deploy.

Local container check:

    docker build -t reddoor-md-pdf .
    docker run --rm -p 8080:8080 reddoor-md-pdf

## Limits

- 1 MB per markdown body
- 10 generations per IP per minute
- 30 s render timeout

See [`docs/superpowers/specs/2026-04-29-md-to-pdf-microapp-design.md`](docs/superpowers/specs/2026-04-29-md-to-pdf-microapp-design.md) for the full design.
```

- [ ] **Step 3: Commit**

```bash
git add static/favicon.svg README.md
git commit -m "docs: add README and favicon"
```

---

## Task 15: End-to-end verification

- [ ] **Step 1: Run the full unit suite**

```bash
pnpm test
```

Expected: all unit specs pass (filename: 10, size-limit: 5, rate-limit: 5, markdown-to-html: 6, renderer: 2 if Chromium available else skipped).

- [ ] **Step 2: Run the Playwright spec**

```bash
pnpm test:e2e
```

Expected: 1 PASS.

- [ ] **Step 3: Run `svelte-check`**

```bash
pnpm check
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Build production bundle**

```bash
pnpm build
```

Expected: `build/` directory produced; no errors.

- [ ] **Step 5: Run the production bundle locally**

```bash
PORT=3000 node build &
sleep 2
curl -s http://localhost:3000/healthz
curl -s -o /tmp/prod.pdf -w "%{http_code}\n" \
  -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# Prod Smoke\n\nLooks good."}'
file /tmp/prod.pdf
kill %1
```

Expected: `{"status":"ok"}`, `200`, then `PDF document, …`.

- [ ] **Step 6: Confirm the docker image works end-to-end**

Repeat the Task 12 docker smoke if not already validated in this session.

- [ ] **Step 7: Push to origin**

```bash
git push origin main
```

(Deploy to Render is a separate user action: in the Render dashboard, **New → Blueprint** → connect the `reddoor-md-pdf` repo. Render auto-deploys on every subsequent push to `main`.)

---

## Spec Coverage Check

| Spec section / requirement | Where it's implemented |
| --- | --- |
| SvelteKit framework | Task 1 |
| Tailwind v4 with Reddoor palette/fonts | Task 2 + Task 10 |
| `md-to-pdf` + `pdf.config.cjs`, byte-similar to current export | Task 7 |
| `node:22-slim` + system Chromium, `PUPPETEER_SKIP_DOWNLOAD=1` | Task 12 |
| Hosted deploy with idle stop / wake (Render free tier instead of Fly — spec lists Render as acceptable alternative) | Task 13 |
| Single-page UI, max-width 720px, mobile-first | Task 10 |
| Textarea-as-drop-target | Task 10 |
| Optional filename input with auto-derived placeholder | Task 10 + Task 3 |
| `POST /api/generate` JSON in, PDF out | Task 8 |
| Filename derivation rules (H1 → slug, fallback to `document.pdf`) | Task 3 |
| 1 MB markdown size cap (413) | Task 4 + Task 8 |
| 10 / IP / minute rate limit (429 + Retry-After) | Task 5 + Task 8 |
| 30 s render timeout (504) | Task 7 + Task 8 |
| Renderer crash mapped to 502 | Task 7 + Task 8 |
| Textarea content preserved on error | Task 10 |
| Vitest unit suite (renderer, slug, soft-gate helpers) | Tasks 3–7 |
| Snapshot intermediate HTML for fixtures (heading, table, link, code) | Task 6 |
| Playwright happy-path | Task 11 |
| `/healthz` for Render health checks | Task 9 + Task 13 |
| README + favicon | Task 14 |

**Deferred from spec (called out explicitly):**

- Warm Puppeteer browser across requests. v1 launches per request via `md-to-pdf`. Revisit if measured render time exceeds ~3 s in production.
- "Copy permalink to filled-in markdown" — out of scope per spec.
