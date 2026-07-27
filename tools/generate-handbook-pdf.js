const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;

    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function toAbsolutePath(filePath, fallback) {
  if (!filePath) return fallback;
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

const args = parseArgs(process.argv.slice(2));
const SOURCE_MD = toAbsolutePath(args.source, path.join(ROOT, 'ADMIN_NUTZERHANDBUCH.md'));
const OUTPUT_PDF = toAbsolutePath(
  args.output,
  path.join(ROOT, `${path.basename(SOURCE_MD, path.extname(SOURCE_MD))}.pdf`)
);

const resolvedDocTitle = args.title || `FixitHub ${path.basename(SOURCE_MD, path.extname(SOURCE_MD)).replace(/_/g, ' ')}`;
const coverKicker = args.kicker || 'FixitHub · Handbuch';
const coverSubtitle = args.subtitle || 'Dokumentation fuer FixitHub';
const footerLabel = args.footer || resolvedDocTitle;

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function createToc(headings) {
  const tocItems = headings
    .filter((h) => h.level >= 2 && h.level <= 3)
    .map((h) => {
      const indentClass = h.level === 3 ? 'toc-item-sub' : 'toc-item-main';
      return `<li class="${indentClass}"><a href="#${h.id}">${h.text}</a></li>`;
    })
    .join('\n');

  return `
    <section class="toc">
      <h2>Inhaltsverzeichnis</h2>
      <ul>${tocItems}</ul>
    </section>
  `;
}

function createChapterChips(headings) {
  const chapterItems = headings
    .filter((h) => h.level === 2)
    .slice(0, 18)
    .map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
    .join('');

  return `<ul class="chapter-chips">${chapterItems}</ul>`;
}

function buildHtml(title, tocHtml, chapterChipsHtml, contentHtml, chapterCount) {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 14mm 18mm 14mm;
      }

      :root {
        --text: #1f2328;
        --muted: #4b5563;
        --border: #d6dee8;
        --surface: #f8fafc;
        --accent: #1a2a5e;
        --accent-2: #f5b800;
        --accent-2-dark: #e5ab00;
        --accent-soft: #eef1f9;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: var(--text);
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
        font-size: 10.75pt;
        line-height: 1.55;
        -webkit-font-smoothing: antialiased;
      }

      .cover {
        border: 1px solid var(--border);
        border-top: 6px solid var(--accent);
        border-radius: 16px;
        background:
          radial-gradient(circle at 15% 12%, #ffffff 0%, #ffffff 40%, #eef1f9 100%),
          linear-gradient(135deg, #ffffff 0%, #f1f4fb 65%, #e9eef8 100%);
        padding: 18mm 14mm 14mm;
        min-height: 250mm;
        page-break-after: always;
        position: relative;
        overflow: hidden;
      }

      .cover::after {
        content: "";
        position: absolute;
        right: -22mm;
        top: -16mm;
        width: 62mm;
        height: 62mm;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(245, 184, 0, 0.30) 0%, rgba(245, 184, 0, 0.10) 58%, rgba(245, 184, 0, 0) 75%);
      }

      .brand-lockup {
        display: flex;
        align-items: center;
        gap: 3mm;
        margin-bottom: 9mm;
      }

      .brand-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 13mm;
        height: 13mm;
        border-radius: 10px;
        background: var(--accent);
        color: var(--accent-2);
        font-family: "Georgia", "Times New Roman", serif;
        font-weight: 700;
        font-size: 18pt;
        box-shadow: 0 4px 14px rgba(26, 42, 94, 0.28);
      }

      .brand-word {
        font-family: "Georgia", "Times New Roman", serif;
        font-size: 17pt;
        font-weight: 700;
        letter-spacing: 0.2px;
        color: var(--accent);
      }

      .brand-word span {
        color: var(--accent-2-dark);
      }

      .brand-tag {
        margin: 0.4mm 0 0;
        font-size: 7.8pt;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: #5c6b7f;
      }

      .cover-kicker {
        display: inline-block;
        padding: 1.5mm 3mm;
        border: 1px solid var(--accent);
        border-radius: 999px;
        background: var(--accent);
        letter-spacing: 0.4px;
        font-size: 8.6pt;
        font-weight: 700;
        color: #ffffff;
        text-transform: uppercase;
      }

      .cover h1 {
        margin: 7mm 0 6mm;
        color: var(--accent);
        font-family: "Georgia", "Times New Roman", serif;
        font-size: 30pt;
        line-height: 1.15;
      }

      .cover p {
        margin: 0 0 4mm;
        color: var(--muted);
        font-size: 11.5pt;
      }

      .cover-summary {
        margin-top: 4mm;
        color: #344255;
      }

      .cover-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 3mm;
        margin-top: 8mm;
      }

      .cover-stat {
        border: 1px solid #d2dbe6;
        border-radius: 10px;
        background: #ffffff;
        padding: 3mm;
      }

      .cover-stat-label {
        margin: 0;
        font-size: 8.2pt;
        text-transform: uppercase;
        letter-spacing: 0.35px;
        color: #5c6b7f;
      }

      .cover-stat-value {
        margin: 1.2mm 0 0;
        font-size: 13pt;
        color: var(--accent);
        font-weight: 700;
      }

      .cover .meta {
        margin-top: 8mm;
        padding: 5mm;
        border-left: 4px solid var(--accent-2);
        background: var(--accent-soft);
        border-radius: 8px;
      }

      .chapter-chips {
        margin: 6mm 0 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: 2.2mm;
      }

      .chapter-chips li a {
        display: inline-block;
        border: 1px solid #d6dee8;
        border-radius: 999px;
        background: #ffffff;
        padding: 1.2mm 2.8mm;
        color: #31445b;
        text-decoration: none;
        font-size: 8.5pt;
      }

      .toc {
        page-break-after: always;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 8mm;
        background: #fff;
      }

      .toc h2 {
        margin: 0 0 5mm;
        color: #1b2f48;
      }

      .toc ul {
        margin: 0;
        padding-left: 4mm;
        list-style: none;
        columns: 2;
        column-gap: 10mm;
      }

      .toc li {
        margin-bottom: 1.8mm;
        break-inside: avoid;
      }

      .toc-item-sub {
        margin-left: 4mm;
      }

      .toc a {
        color: #164977;
        text-decoration: none;
      }

      main {
        margin: 0;
      }

      h1,
      h2,
      h3,
      h4 {
        color: #122942;
        line-height: 1.25;
        margin-top: 8mm;
        margin-bottom: 3mm;
        break-after: avoid;
      }

      h1 {
        font-size: 19pt;
        font-family: "Georgia", "Times New Roman", serif;
        color: var(--accent);
        border-bottom: 2px solid var(--accent-2);
        padding-bottom: 2mm;
      }

      h2 {
        font-size: 15pt;
        color: var(--accent);
        border-left: 4px solid var(--accent-2);
        padding-left: 2.5mm;
      }

      h3 {
        font-size: 12pt;
      }

      p,
      li {
        widows: 2;
        orphans: 2;
      }

      p {
        margin: 0 0 3mm;
      }

      ul,
      ol {
        margin-top: 0;
        margin-bottom: 3mm;
        padding-left: 6mm;
      }

      blockquote {
        margin: 3mm 0;
        border-left: 3px solid #9bb3c8;
        background: #f8fbff;
        padding: 2.5mm 3mm;
        color: #2d4d6b;
      }

      code {
        background: #f2f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 0.2em 0.42em;
        font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
        font-size: 9.5pt;
      }

      pre {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 8px;
        padding: 3.2mm;
        overflow: auto;
        font-size: 9pt;
        line-height: 1.4;
        margin: 3mm 0 4mm;
      }

      pre code {
        border: 0;
        background: transparent;
        color: inherit;
        padding: 0;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 3mm 0 5mm;
        font-size: 9.6pt;
        page-break-inside: avoid;
        border-radius: 8px;
        overflow: hidden;
      }

      thead th {
        background: #f0f4f9;
        color: #203852;
      }

      th,
      td {
        border: 1px solid var(--border);
        padding: 2mm 2.3mm;
        text-align: left;
        vertical-align: top;
      }

      tr:nth-child(even) td {
        background: var(--surface);
      }

      hr {
        border: 0;
        border-top: 1px solid var(--border);
        margin: 6mm 0;
      }

      img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 3.5mm auto 5mm;
        border: 1px solid #d9e1ea;
        border-radius: 8px;
        box-shadow: 0 3px 14px rgba(15, 23, 42, 0.08);
        page-break-inside: avoid;
      }

      figure {
        margin: 0;
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    <section class="cover">
      <div class="brand-lockup">
        <span class="brand-mark">F</span>
        <div>
          <div class="brand-word">Fixit<span>Hub</span></div>
          <p class="brand-tag">Reparaturservice &middot; Smartphone &middot; Tablet &middot; Notebook</p>
        </div>
      </div>
      <span class="cover-kicker">${coverKicker}</span>
      <h1>${title}</h1>
      <p>${coverSubtitle}</p>
      <p class="cover-summary">Kompakte Referenz fuer Konfiguration, Prozesse, Felder und Datenfluesse im Tagesbetrieb.</p>
      <div class="cover-stats">
        <div class="cover-stat">
          <p class="cover-stat-label">Kapitel</p>
          <p class="cover-stat-value">${chapterCount}</p>
        </div>
        <div class="cover-stat">
          <p class="cover-stat-label">Format</p>
          <p class="cover-stat-value">A4 Print</p>
        </div>
        <div class="cover-stat">
          <p class="cover-stat-label">Sprache</p>
          <p class="cover-stat-value">Deutsch</p>
        </div>
      </div>
      <div class="meta">
        <p><strong>Ziel:</strong> Schnelle Orientierung, klare Prozessbeschreibung und direkte Nachschlagbarkeit.</p>
        <p><strong>Format:</strong> Druckoptimiert (A4), strukturierte Kapitel, tabellarische Referenzen.</p>
        <p><strong>Stand:</strong> ${new Date().toLocaleDateString('de-DE')}</p>
      </div>
      ${chapterChipsHtml}
    </section>
    ${tocHtml}
    <main>
      ${contentHtml}
    </main>
  </body>
</html>`;
}

function getMimeTypeForImage(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.svg') return 'image/svg+xml';

  return 'application/octet-stream';
}

function rewriteRelativeImagePaths(html) {
  return html.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/g, (fullMatch, before, src, after) => {
    if (/^(https?:|data:|file:)/i.test(src)) {
      return fullMatch;
    }

    const absolutePath = path.resolve(path.dirname(SOURCE_MD), src);

    if (!fs.existsSync(absolutePath)) {
      console.warn(`Bilddatei nicht gefunden, belasse Originalpfad: ${src}`);
      return fullMatch;
    }

    const mimeType = getMimeTypeForImage(absolutePath);
    const encodedImage = fs.readFileSync(absolutePath).toString('base64');
    const dataUri = `data:${mimeType};base64,${encodedImage}`;
    return `<img${before}src="${dataUri}"${after}>`;
  });
}

async function generatePdf() {
  if (!fs.existsSync(SOURCE_MD)) {
    throw new Error(`Datei nicht gefunden: ${SOURCE_MD}`);
  }

  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome wurde nicht gefunden unter: ${CHROME_PATH}`);
  }

  const markdown = fs.readFileSync(SOURCE_MD, 'utf8');
  const headings = [];

  const renderer = new marked.Renderer();
  renderer.heading = (token) => {
    const text = token.text;
    const level = token.depth;
    const id = slugify(text);
    headings.push({ text, level, id });
    return `<h${level} id="${id}">${text}</h${level}>`;
  };

  marked.setOptions({
    gfm: true,
    breaks: false,
    renderer
  });

  const contentHtml = rewriteRelativeImagePaths(marked.parse(markdown));
  const tocHtml = createToc(headings);
  const chapterChipsHtml = createChapterChips(headings);
  const chapterCount = headings.filter((h) => h.level === 2).length;
  const title = resolvedDocTitle;
  const html = buildHtml(title, tocHtml, chapterChipsHtml, contentHtml, chapterCount);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: OUTPUT_PDF,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="font-size:8px;width:100%;padding:0 10mm;color:#5f6b7a;display:flex;justify-content:space-between;">' +
        `<span>${footerLabel}</span>` +
        '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span>' +
        '</div>',
      margin: {
        top: '14mm',
        right: '12mm',
        bottom: '16mm',
        left: '12mm'
      }
    });
  } finally {
    await browser.close();
  }

  console.log(`PDF erfolgreich erstellt: ${OUTPUT_PDF}`);
}

generatePdf().catch((error) => {
  console.error('Fehler bei der PDF-Erstellung:', error.message);
  process.exit(1);
});