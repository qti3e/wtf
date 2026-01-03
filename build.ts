import { walk } from "@std/fs/walk";
import { ensureDir } from "@std/fs/ensure-dir";
import { copy } from "@std/fs/copy";
import { dirname, join, relative } from "@std/path";
import { buildPage, DEFAULT_DESC } from "./lib.ts";

const CONTENT_DIR = "./content";
const STATIC_DIR = "./static";
const OUTPUT_DIR = "./dist";
const CSS_FILE = "./main.css";
const CNAME_FILE = "./static/CNAME";

async function readCNAME(path: string): Promise<string | null> {
  try {
    const content = await Deno.readTextFile(path);
    return content.trim() || null;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

interface BuildOptions {
  contentDir?: string;
  staticDir?: string;
  outputDir?: string;
  cssFile?: string;
  cnameFile?: string;
  host?: string;
  minify?: boolean;
}

async function build(options: BuildOptions = {}): Promise<void> {
  const {
    contentDir = CONTENT_DIR,
    staticDir = STATIC_DIR,
    outputDir = OUTPUT_DIR,
    cssFile = CSS_FILE,
    cnameFile = CNAME_FILE,
    minify = true,
  } = options;

  // Read host from CNAME file or use provided/default
  const host = options.host ?? await readCNAME(cnameFile) ?? "localhost";

  console.log(`Building static site...`);
  console.log(`  Content: ${contentDir}`);
  console.log(`  Output:  ${outputDir}`);
  console.log(`  Host:    ${host}`);

  // Clean and create output directory
  try {
    await Deno.remove(outputDir, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await ensureDir(outputDir);

  // Read CSS
  const css = await Deno.readTextFile(cssFile);

  // Process all markdown files
  let pageCount = 0;
  const urls: string[] = [];
  const mdUrls: string[] = [];
  interface FeedItem {
    title: string;
    url: string;
    desc: string;
    date: string;
  }
  const feedItems: FeedItem[] = [];
  for await (const entry of walk(contentDir, {
    exts: [".md"],
    includeDirs: false,
  })) {
    const relativePath = relative(contentDir, entry.path);
    const mdFile = relativePath;
    const isIndex = relativePath === "index.md";

    // Determine output path: foo.md -> foo/index.html, index.md -> index.html
    const htmlPath = isIndex
      ? join(outputDir, "index.html")
      : join(outputDir, relativePath.replace(/\.md$/, ""), "index.html");

    // Read and process markdown
    const content = await Deno.readTextFile(entry.path);
    const { html, canonicalUrl, title, desc, date } = await buildPage({
      content,
      css,
      host,
      mdFile,
      isIndex,
      minify,
    });

    // Collect URLs for sitemap and llms.txt
    urls.push(canonicalUrl);
    mdUrls.push(`https://${host}/${relativePath}`);

    // Collect feed items (only posts with title and date, excluding index/about)
    if (title && date && !isIndex && relativePath !== "about.md") {
      feedItems.push({ title, url: canonicalUrl, desc, date });
    }

    // Write HTML file
    await ensureDir(dirname(htmlPath));
    await Deno.writeTextFile(htmlPath, html);

    // Also write the raw markdown file for curl access
    const rawMdPath = join(outputDir, relativePath);
    await ensureDir(dirname(rawMdPath));
    await Deno.writeTextFile(rawMdPath, content);

    console.log(`  ${relativePath} -> ${relative(outputDir, htmlPath)}`);
    pageCount++;
  }

  // Copy static files
  try {
    await copy(staticDir, join(outputDir, "static"), { overwrite: true });
    console.log(`  Copied static files`);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
    console.log(`  No static directory found, skipping`);
  }

  // Copy CNAME to root for GitHub Pages
  const cname = await readCNAME(cnameFile);
  if (cname) {
    await Deno.writeTextFile(join(outputDir, "CNAME"), cname);
    console.log(`  CNAME: ${cname}`);
  }

  // Create .nojekyll to skip Jekyll processing on GitHub Pages
  await Deno.writeTextFile(join(outputDir, ".nojekyll"), "");
  console.log(`  Generated .nojekyll`);

  // Generate sitemap.xml
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`).join("\n")}
</urlset>
`;
  await Deno.writeTextFile(join(outputDir, "sitemap.xml"), sitemap);
  console.log(`  Generated sitemap.xml (${urls.length} URLs)`);

  // Generate llms.txt
  const sortedMdUrls = mdUrls.sort((a, b) => {
    const aName = a.split("/").pop()!;
    const bName = b.split("/").pop()!;
    if (aName === "index.md") return -1;
    if (bName === "index.md") return 1;
    if (aName === "about.md") return -1;
    if (bName === "about.md") return 1;
    return aName.localeCompare(bName);
  });
  const llmsTxt = `# Parsa's Blog

> ${DEFAULT_DESC}

${sortedMdUrls.map((url) => `- ${url}`).join("\n")}
`;
  await Deno.writeTextFile(join(outputDir, "llms.txt"), llmsTxt);
  console.log(`  Generated llms.txt (${mdUrls.length} files)`);

  // Generate RSS feed
  const sortedFeedItems = feedItems.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Parsa's Blog</title>
    <link>https://${host}/</link>
    <description>${DEFAULT_DESC}</description>
    <atom:link href="https://${host}/feed.xml" rel="self" type="application/rss+xml"/>
${sortedFeedItems.map((item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.url}</link>
      <guid>${item.url}</guid>
      <pubDate>${new Date(item.date).toUTCString()}</pubDate>
      <description>${escapeXml(item.desc)}</description>
    </item>`).join("\n")}
  </channel>
</rss>
`;
  await Deno.writeTextFile(join(outputDir, "feed.xml"), rss);
  console.log(`  Generated feed.xml (${feedItems.length} items)`);

  // Generate robots.txt
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://${host}/sitemap.xml
`;
  await Deno.writeTextFile(join(outputDir, "robots.txt"), robotsTxt);
  console.log(`  Generated robots.txt`);

  console.log(`\nBuild complete: ${pageCount} pages generated`);
}

// CLI entry point
if (import.meta.main) {
  const host = Deno.args[0] || undefined;
  await build({ host });
}

export { build };
export type { BuildOptions };
