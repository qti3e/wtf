import { extractYaml, test } from "@std/front-matter";
import { render } from "@deno/gfm";
import { minify as csso } from "npm:csso@5.0.5";
import { PurgeCSS } from "npm:purgecss@6.0.0";
import "npm:prismjs@^1.29";

export const DEFAULT_DESC = "My random thoughts on computers";

import "npm:prismjs@1.29.0/components/prism-typescript.js";
import "npm:prismjs@1.29.0/components/prism-rust.js";
import "npm:prismjs@1.29.0/components/prism-bash.js";
import "npm:prismjs@1.29.0/components/prism-awk.js";
import "npm:prismjs@1.29.0/components/prism-c.js";
import "npm:prismjs@1.29.0/components/prism-diff.js";
import "npm:prismjs@1.29.0/components/prism-wasm.js";
import "npm:prismjs@1.29.0/components/prism-nix.js";

export interface TocEntry {
  level: number;
  text: string;
  slug: string;
}

export interface FrontMatter {
  title?: string;
  desc?: string;
  date?: string;
  [key: string]: string | undefined;
}

export interface PageData {
  content: string;
  toc: string;
  css: string;
  host: string;
  mdFile: string;
  canonicalUrl: string;
  title?: string;
  desc: string;
  date?: string;
}

export interface ProcessedMarkdown {
  body: string;
  attrs: FrontMatter;
  headings: TocEntry[];
  html: string;
}

export function parseHeadings(markdown: string): TocEntry[] {
  const headings: TocEntry[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const slug = text
        .toLowerCase()
        .replace(/<[^>]*>/g, "")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      headings.push({ level, text, slug });
    }
  }

  return headings;
}

export function renderToc(headings: TocEntry[]): string {
  if (headings.length === 0) return "";

  let html = '<nav class="toc"><ul>';

  for (const heading of headings) {
    const indent = heading.level - 1;
    html += `<li class="toc-item toc-level-${heading.level}" style="--indent: ${indent}">`;
    html += `<a href="#${heading.slug}">${heading.text}</a>`;
    html += "</li>";
  }

  html += "</ul></nav>";
  return html;
}

export function renderPage($: PageData): string {
  return `<!DOCTYPE html>
<html lang="en">
 <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parsa's Blog${$.title ? ` | ${$.title}` : ``}</title>
    <meta name="author" content="Parsa G.">
    <meta name="description" content="${$.desc}">
    <meta property="og:title" content="Parsa's Blog${$.title ? ` | ${$.title}` : ``}">
    <meta property="og:description" content="${$.desc}">
    <meta property="og:url" content="${$.canonicalUrl}">
    <meta property="og:type" content="${$.title ? "article" : "website"}">
    <meta property="og:site_name" content="Parsa's Blog">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="Parsa's Blog${$.title ? ` | ${$.title}` : ``}">
    <meta name="twitter:description" content="${$.desc}">
    <link rel="canonical" href="${$.canonicalUrl}">
    <link rel="alternate" type="text/markdown" href="https://${$.host}/${$.mdFile}">
    <link rel="alternate" type="application/rss+xml" title="Parsa's Blog" href="https://${$.host}/feed.xml">
    <link rel="icon" href="data:image/svg+xml,
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
  <text y='0.9em' fill='rgb(200,162,200)' font-size='90'>λ</text>
</svg>">
    <style>
${$.css}
    </style>
    <script>
    document.addEventListener('DOMContentLoaded', () => {
      const headings = [...document.querySelectorAll('.content h1[id], .content h2[id], .content h3[id], .content h4[id]')];
      const links = document.querySelectorAll('.toc a');
      const side = document.querySelector('.side');
      const update = () => {
        const vh = window.innerHeight;
        // ToC active state
        if (headings.length && links.length) {
          let active = null, lastPassed = null;
          for (const h of headings) {
            const top = h.getBoundingClientRect().top;
            if (top <= 0) lastPassed = h;
            if (top >= 0 && top < vh) active = h;
          }
          active = active || lastPassed || headings[0];
          links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + active.id));
        }
        // Progress bar
        if (side) {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - vh;
          const pct = docHeight > 1 ? Math.min(100, Math.max(0, scrollTop / docHeight * 100)) : 100;
          side.style.setProperty('--progress', pct + '%');
        }
      };
      document.addEventListener('scroll', update, { passive: true });
      update();
    });
    </script>
  </head>
  <body>
    <div class="side">
      <div class="bar"></div><div class="bar"></div><div class="bar"></div>
      <div class="bar"></div><div class="bar"></div><div class="bar"></div>
    </div>
    <div class="page">
      ${$.toc}
      <div class="container">
      <header class="header">
        <h1><a href="/">Parsa's Blog</a></h1>
        <ul>
          <li>
            <a target="_blank" href="https://github.com/qti3e">
              <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="#fff"/></svg>
            </a>
          </li>
        </ul>
      </header>
      <main class="content">
      ${$.content}
      </main>
      <footer class="footer">
        <p class="clip-copy">curl "https://${$.host}/${$.mdFile}" | less</p>
        ${$.date ? `<p>${$.date}</p>` : ""}
      </footer>
      </div>
    </div>
  </body>
</html>`;
}

export function processMarkdown(content: string): ProcessedMarkdown {
  const { body, attrs } = test(content, ["yaml"])
    ? extractYaml(content)
    : { body: content, attrs: {} };

  if (typeof attrs !== "object" || attrs === null) {
    throw new Error("Unexpected front matter");
  }

  const headings = parseHeadings(body);
  const html = render(body, { allowedAttributes: { span: ["style"] } });

  return {
    body,
    attrs: attrs as FrontMatter,
    headings,
    html,
  };
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function minifyCSS(css: string): string {
  return csso(css).css;
}

export async function purgeCSS(css: string, html: string): Promise<string> {
  const result = await new PurgeCSS().purge({
    content: [{ raw: html, extension: "html" }],
    css: [{ raw: css }],
    safelist: {
      // Keep classes that are added dynamically via JS
      standard: ["active"],
      // Keep CSS variable declarations
      variables: [/^--/],
    },
  });
  return result[0]?.css ?? css;
}

export async function optimizeCSS(css: string, html: string): Promise<string> {
  const purged = await purgeCSS(css, html);
  return minifyCSS(purged);
}

export interface BuildPageOptions {
  content: string;
  css: string;
  host: string;
  mdFile: string;
  isIndex: boolean;
  minify?: boolean;
}

export interface BuildPageResult {
  html: string;
  canonicalUrl: string;
  title?: string;
  desc: string;
  date?: string;
}

export async function buildPage(options: BuildPageOptions): Promise<BuildPageResult> {
  const { content, css, host, mdFile, isIndex, minify = false } = options;
  const processed = processMarkdown(content);
  const toc = renderToc(processed.headings);

  // Compute canonical URL
  const urlPath = isIndex ? "/" : "/" + mdFile.replace(/\.md$/, "") + "/";
  const canonicalUrl = `https://${host}${urlPath}`;

  const pageData = {
    content: processed.html,
    toc,
    css,
    host,
    mdFile,
    canonicalUrl,
    title: isIndex
      ? undefined
      : processed.attrs.title ?? processed.body.match(/^\s*#(.+)/i)?.[1]?.trim(),
    desc: processed.attrs.desc ?? DEFAULT_DESC,
    date: processed.attrs.date ? formatDate(processed.attrs.date) : undefined,
  };

  const result = {
    canonicalUrl,
    title: pageData.title,
    desc: pageData.desc,
    date: processed.attrs.date,
  };

  if (!minify) {
    return { html: renderPage(pageData), ...result };
  }

  // Render full page first to get complete HTML for purging
  const fullHtml = renderPage(pageData);
  const optimizedCSS = await optimizeCSS(css, fullHtml);

  return { html: renderPage({ ...pageData, css: optimizedCSS }), ...result };
}
