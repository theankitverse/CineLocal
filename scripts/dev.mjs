import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import handler from "../api/tmdb.js";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};
const root = process.cwd();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/tmdb") {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => res.end(JSON.stringify(data));
    return handler(req, res);
  }
  try {
    const pathname = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
    const allowed =
      pathname === "/index.html" ||
      pathname === "/favicon.svg" ||
      pathname === "/manifest.webmanifest" ||
      /^\/(js|css|assets)\/[\w./-]+$/.test(pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (
      !allowed ||
      !file.startsWith(root + path.sep) ||
      pathname.includes("..")
    )
      throw new Error("Not found");
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(Number(process.env.PORT) || 3000, "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${server.address().port}`),
);
