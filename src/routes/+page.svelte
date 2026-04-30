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
