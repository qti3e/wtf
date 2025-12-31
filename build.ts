import { walk } from "@std/fs/walk";
import { ensureDir } from "@std/fs/ensure-dir";
import { copy } from "@std/fs/copy";
import { dirname, join, relative } from "@std/path";
import { buildPage } from "./lib.ts";

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
    const html = await buildPage({
      content,
      css,
      host,
      mdFile,
      isIndex,
      minify,
    });

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

  console.log(`\nBuild complete: ${pageCount} pages generated`);
}

// CLI entry point
if (import.meta.main) {
  const host = Deno.args[0] || undefined;
  await build({ host });
}

export { build };
export type { BuildOptions };
