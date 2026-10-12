import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of [
  "index.html",
  "css",
  "js",
  "assets",
  "favicon.svg",
  "manifest.webmanifest",
])
  await cp(file, `dist/${file}`, { recursive: true });
console.log("Built CineLocal → dist/ (server credentials excluded)");
