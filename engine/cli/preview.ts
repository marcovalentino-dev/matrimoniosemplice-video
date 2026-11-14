import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

/** Server statico sulla radice del repo, solo su 127.0.0.1. Per ora serve brand/preview.html. */
export function startPreview(root: string, port = 0, virtual: Record<string, string> = {}): Promise<http.Server> {
  const base = path.resolve(root);
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      // Pagine generate in memoria (es. la pagina host del render): nessun file su disco.
      const mem = virtual[url.pathname];
      if (mem !== undefined) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(mem);
      }
      const p = path.resolve(base, "." + decodeURIComponent(url.pathname));
      const inside = p === base || p.startsWith(base + path.sep);
      if (!inside || !existsSync(p) || statSync(p).isDirectory()) {
        res.writeHead(404);
        return res.end("404");
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      createReadStream(p).pipe(res);
    });
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}
