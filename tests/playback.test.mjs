import test from "node:test";
import assert from "node:assert/strict";
import { directVideoUrl } from "../js/playback.js";

test("direct video links retain signed queries and support HTTPS file formats", () => {
  const url =
    "https://media.example.com/My%20Film.MP4?signature=abc&expires=42";
  assert.equal(directVideoUrl(` ${url} `), url);
  for (const extension of ["webm", "m4v", "ogv"])
    assert.equal(
      directVideoUrl(`https://media.example.com/movie.${extension}`),
      `https://media.example.com/movie.${extension}`,
    );
});

test("direct video rejects scripts, embedded pages, insecure URLs and embedded credentials", () => {
  for (const value of [
    "",
    "/movie.mp4",
    "javascript:alert(1)",
    "data:video/mp4;base64,AA",
    "http://media.example.com/movie.mp4",
    "https://user:password@media.example.com/movie.mp4",
    "https://player.example.com/embed/movie/1",
    "https://player.example.com/?file=movie.mp4",
    "https://media.example.com/movie.m3u8",
  ])
    assert.throws(() => directVideoUrl(value));
});

test("direct video CSP permits media sources without widening script or frame access", async () => {
  const { readFile } = await import("node:fs/promises");
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  const csp = config.headers[0].headers.find(
    (h) => h.key === "Content-Security-Policy",
  ).value;
  assert.match(csp, /media-src 'self' blob: https:;/);
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(csp, /frame-src [^;]*\*/);
});
