# Reddoor Markdown → PDF

A tiny SvelteKit app: paste markdown, get a Reddoor-branded PDF.

The PDF rendering pipeline mirrors `reddoor-starter`'s `pnpm export:rfp-pdf` — same fonts, same brand colors, same page layout — lifted into a hosted form so anyone with the URL can use it. The config (`src/lib/server/pdf-config.ts`) is bundled into the production build.

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
