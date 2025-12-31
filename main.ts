import { serveDir } from "@std/http";
import { buildPage } from "./lib.ts";

const staticPathPattern = new URLPattern({ pathname: "/static/*" });

const STYLESHEET = Deno.readTextFile("./main.css");

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

      const rendered = await buildPage({
        content,
        css: await STYLESHEET,
        host: url.host,
        mdFile,
        isIndex: pathname === "/",
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
