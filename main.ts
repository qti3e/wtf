import { serveDir } from "@std/http";
import { extractYaml, test } from "@std/front-matter";
import { render } from "@deno/gfm";
import "npm:prismjs@^1.29";

import "npm:prismjs@1.29.0/components/prism-typescript.js";
import "npm:prismjs@1.29.0/components/prism-rust.js";
import "npm:prismjs@1.29.0/components/prism-bash.js";
import "npm:prismjs@1.29.0/components/prism-awk.js";
import "npm:prismjs@1.29.0/components/prism-c.js";
import "npm:prismjs@1.29.0/components/prism-diff.js";
import "npm:prismjs@1.29.0/components/prism-wasm.js";
import "npm:prismjs@1.29.0/components/prism-nix.js";

const staticPathPattern = new URLPattern({ pathname: "/static/*" });

const STYLESHEET = Deno.readTextFile("./main.css");

interface TocEntry {
  level: number;
  text: string;
  slug: string;
}

function parseHeadings(markdown: string): TocEntry[] {
  const headings: TocEntry[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // Generate slug matching @deno/gfm's anchor generation
      const slug = text
        .toLowerCase()
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/[^\w\s-]/g, "") // Remove special chars except hyphens
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Collapse multiple hyphens
        .replace(/^-|-$/g, ""); // Trim hyphens from ends
      headings.push({ level, text, slug });
    }
  }

  return headings;
}

function renderToc(headings: TocEntry[]): string {
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

const renderPage = (
  $: {
    content: string;
    toc: string;
    css: string;
    host: string;
    mdFile: string;
    title?: string;
    desc: string;
    date?: string;
  },
) =>
  `<!DOCTYPE html>
<html lang="en">
 <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parsa's Blog${$.title ? ` | ${$.title}` : ``}</title>
    <meta name="author" content="Parsa G.">
    <meta name="description" content="${$.desc}">
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

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          "cache-control": "immutable, public, max-age=31536000",
        },
      });
    }

    if (staticPathPattern.test(url)) {
      return serveDir(req, {
        headers: [
          "cache-control: public, max-age=600, s-maxage=31536000",
        ],
      });
    }

    if (!pathname.match(/^[a-zA-Z0-9/-_]*(\.md)?$/g)) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "cache-control": "immutable, public, max-age=31536000",
        },
      });
    }

    const mdFile = pathname === "/"
      ? "index.md"
      : (pathname.endsWith(".md") ? pathname : `${pathname}.md`).replace(
        /^\//,
        "",
      );

    const serveMd = pathname.endsWith(".md") ||
      (req.headers.get("user-agent")?.startsWith("curl/") &&
        req.headers.get("accept") === "*/*");

    try {
      const content = await Deno.readTextFile(`./content/${mdFile}`);
      const { body, attrs }: { body: string; attrs: Record<string, string> } =
        test(content, ["yaml"])
          ? extractYaml(content)
          : { body: content, attrs: {} };

      if (typeof attrs !== "object" || attrs === null) {
        throw new Error("Unexpected front matter");
      }

      if (serveMd) {
        return new Response(content, {
          status: 200,
          headers: {
            "content-type": "text/markdown",
            "vary": "accept, user-agent",
            "cache-control": "public, max-age=600, s-maxage=31536000",
          },
        });
      }

      const headings = parseHeadings(body);
      const rendered = renderPage({
        content: render(body, { allowedAttributes: { span: ["style"] } }),
        toc: renderToc(headings),
        css: await STYLESHEET,
        host: url.host,
        mdFile,
        title: pathname === "/"
          ? undefined
          : attrs["title"] ?? body.match(/^\s*#(.+)/i)?.[1]?.trim(),
        desc: attrs["desc"] ?? "My random thoughts on computers",
        date: attrs["date"]
          ? new Date(attrs["date"])
            .toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : undefined,
      });

      return new Response(rendered, {
        status: 200,
        headers: {
          "content-type": "text/html",
          "vary": "accept, user-agent",
          "cache-control": "public, max-age=600, s-maxage=31536000",
        },
      });
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return new Response("Not found", { status: 404 });
      }
      throw e;
    }
  },
} satisfies Deno.ServeDefaultExport;
