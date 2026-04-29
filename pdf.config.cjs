/**
 * Config for `md-to-pdf` exports.
 *
 * Style baseline: reddoor-website palette and typography
 *   - body: #6d6e71 (mid gray)
 *   - dark:  #424B5A (headings, strong)
 *   - red:   #D71920 (accents, links, sub-labels)
 *   - light: #BBBDBF (borders, dividers)
 *   - h1/h3/body: Helvetica Neue (matches site's Pragmatica fallback)
 *   - h2:        Besley serif (matches site)
 *
 * Usage:
 *   pnpm export:pdf
 *   (or directly: npx md-to-pdf --config-file pdf.config.js docs/rfp-handbook.md)
 */

module.exports = {
  pdf_options: {
    format: "letter",
    margin: {
      top: "0.85in",
      right: "0.85in",
      bottom: "0.85in",
      left: "0.85in",
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 0; height: 0;"></div>',
    footerTemplate: `
      <div style="font-size: 11px; color: #6d6e71; width: 100%; padding: 0 0.85in; display: flex; justify-content: space-between; font-family: Helvetica, Arial, sans-serif;">
        <span class="title"></span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `,
  },
  css: `
    @import url('https://use.typekit.net/alh8out.css');
    @import url('https://fonts.googleapis.com/css2?family=Besley:wght@300;400;600&display=swap');

    body {
      font-family: "pragmatica", "Helvetica Neue", Helvetica, "Segoe UI", system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.55;
      color: #6d6e71;
      font-weight: 350;
    }
    h1 {
      font-family: "pragmatica", "Helvetica Neue", Helvetica, system-ui, sans-serif;
      font-size: 37px;
      font-weight: 200;
      color: #424B5A;
      margin: 0 0 0.6em 0;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #BBBDBF;
      letter-spacing: -0.01em;
    }
    h2 {
      font-family: "Besley", Georgia, "Times New Roman", serif;
      font-size: 24px;
      font-weight: 300;
      color: #424B5A;
      margin-top: 0;
      margin-bottom: 0.4em;
      break-before: page;
      break-after: avoid;
    }
    h3 {
      font-family: "pragmatica", "Helvetica Neue", Helvetica, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #D71920;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 1.4em;
      margin-bottom: 0.3em;
      break-after: avoid;
    }
    h4 {
      font-size: 15px;
      font-weight: 600;
      color: #424B5A;
      margin-top: 1em;
      margin-bottom: 0.3em;
      break-after: avoid;
    }
    p, ul, ol {
      orphans: 3;
      widows: 3;
    }
    p {
      margin: 0.6em 0;
    }
    ul, ol {
      margin: 0.5em 0;
      padding-left: 1.4em;
    }
    li {
      margin: 0.2em 0;
    }
    li > p {
      margin: 0.2em 0;
    }
    strong {
      color: #424B5A;
      font-weight: 600;
    }
    em {
      color: #424B5A;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      background: #f5f5f5;
      padding: 1px 5px;
      border-radius: 3px;
      color: #424B5A;
    }
    pre {
      background: #f5f5f5;
      padding: 0.8em;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 12px;
      break-inside: avoid;
    }
    pre code {
      background: none;
      padding: 0;
      font-size: inherit;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      font-size: 13px;
      break-inside: avoid;
    }
    th {
      background: #f5f5f5;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #424B5A;
      font-weight: 600;
      color: #424B5A;
      vertical-align: top;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #BBBDBF;
      vertical-align: top;
    }
    tr:last-child td {
      border-bottom: none;
    }
    blockquote {
      border-left: 3px solid #D71920;
      padding-left: 1em;
      margin: 1em 0;
      color: #6d6e71;
      font-style: italic;
    }
    hr {
      display: none;
    }
    a {
      color: #D71920;
      text-decoration: underline;
      text-decoration-color: rgba(215, 25, 32, 0.35);
      text-underline-offset: 2px;
    }
    /* Keep tables together with their preceding heading */
    h2 + table, h3 + table, h4 + table,
    h2 + p + table, h3 + p + table {
      page-break-before: avoid;
    }
  `,
};
