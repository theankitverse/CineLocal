import test from "node:test";
import assert from "node:assert/strict";
import {
  createStore,
  mediaKey,
  normalizeMedia,
  sanitizeState,
  STORAGE_KEY,
} from "../js/store.js";
import { escape, imageUrl } from "../js/ui.js";
import { providerUrl, PROVIDERS } from "../js/config.js";
import handler, { buildUpstreamUrl } from "../api/tmdb.js";
const memory = (seed) => {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
  };
};
const movie = {
  id: 42,
  media_type: "movie",
  title: 'A "quoted" title',
  poster_path: "/poster.jpg",
  vote_average: 8,
};
const series = {
  id: 42,
  media_type: "tv",
  name: "A series",
  first_air_date: "2024-01-01",
  poster_path: "/tv.jpg",
};

test("TV watchlist survives storage roundtrip with its type and date", () => {
  const storage = memory();
  const store = createStore(storage);
  store.toggle("watchlist", series);
  const saved = createStore(storage).get().watchlist[0];
  assert.equal(saved.media_type, "tv");
  assert.equal(saved.title, "A series");
  assert.equal(saved.release_date, "2024-01-01");
});
test("movie and TV identities never collide", () => {
  const store = createStore(memory());
  store.toggle("watchlist", movie);
  store.toggle("watchlist", series);
  store.remember(movie);
  store.remember(series);
  assert.equal(store.get().watchlist.length, 2);
  assert.equal(store.get().history.length, 2);
  store.toggle("watchlist", series);
  assert.equal(store.get().watchlist[0].media_type, "movie");
});
test("storage mutations notify immediately and keep snapshots isolated", () => {
  let updates = 0;
  const store = createStore(memory(), () => updates++);
  store.toggle("watchlist", movie);
  store.remember(movie);
  assert.equal(updates, 2);
  store.get().watchlist.length = 0;
  assert.equal(store.get().watchlist.length, 1);
});
test("corrupt current and legacy storage do not block startup", () => {
  const store = createStore(
    memory({
      [STORAGE_KEY]: "{broken",
      cinelocal_history: "{bad",
      cinelocal_watchlist: "null",
    }),
  );
  assert.deepEqual(store.get().history, []);
  assert.deepEqual(store.get().watchlist, []);
  assert.match(store.getIssue(), /could not be read/);
});
test("legacy TV metadata migrates without dropping media type", () => {
  const store = createStore(
    memory({
      cinelocal_watchlist: JSON.stringify([series]),
      cinelocal_history: JSON.stringify([movie]),
    }),
  );
  assert.equal(store.get().watchlist[0].media_type, "tv");
  assert.equal(store.get().history.length, 1);
});
test("failed storage writes roll back instead of pretending data was saved", () => {
  const store = createStore({
    getItem: () => null,
    setItem: () => {
      throw new Error("Quota");
    },
  });
  assert.throws(() => store.toggle("watchlist", movie), /storage is full/);
  assert.equal(store.get().watchlist.length, 0);
});
test("history preserves selected TV episode and stays bounded", () => {
  const store = createStore(memory());
  for (let id = 1; id <= 110; id++) store.remember({ ...movie, id });
  assert.equal(store.get().history.length, 100);
  store.remember(series, { season: 3, episode: 7 });
  const saved = store.get().history[0];
  assert.equal(saved.season, 3);
  assert.equal(saved.episode, 7);
  assert.equal(saved.media_type, "tv");
});
test("special season zero is preserved", () => {
  assert.equal(normalizeMedia({ ...series, season: 0 }).season, 0);
});
test("import validates schema and removes unsafe artwork and invalid records", () => {
  const store = createStore(memory());
  assert.throws(() => store.import({ watchlist: [] }), /valid CineLocal/);
  store.import({
    version: 2,
    watchlist: [
      { ...movie, poster_path: '" onerror="alert(1)' },
      { ...movie },
      { id: -1 },
    ],
    history: [],
    watched: [],
    settings: { name: "a".repeat(100), defaultServer: "evil" },
    ratings: { "tv:42": 5, "movie:42": 99 },
  });
  assert.equal(store.get().watchlist.length, 1);
  assert.equal(store.get().watchlist[0].poster_path, null);
  assert.equal(store.get().settings.name.length, 30);
  assert.equal(store.get().settings.defaultServer, "rivestream");
  assert.deepEqual(store.get().ratings, { "tv:42": 5 });
});
test("ratings, completion and backup restore preserve independent collections", () => {
  const store = createStore(memory());
  store.toggle("watched", movie);
  store.rate(movie, 4);
  store.remember(series);
  const backup = store.get();
  const other = createStore(memory());
  other.import(backup);
  other.clearHistory();
  assert.equal(other.get().watched.length, 1);
  assert.equal(other.get().ratings[mediaKey(movie)], 4);
  assert.equal(other.get().history.length, 0);
});
test("HTML text and attributes escape quotes and markup", () => {
  assert.equal(
    escape("\"<img onerror='x'>&"),
    "&quot;&lt;img onerror=&#39;x&#39;&gt;&amp;",
  );
  assert.equal(imageUrl("https://evil.example/a.jpg"), "");
  assert.equal(imageUrl('/a.jpg" onerror="x'), "");
  assert.match(
    imageUrl("/safe.jpg"),
    /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/safe.jpg$/,
  );
});
test("provider URLs handle movie, TV, specials and IMDb identifiers", () => {
  assert.equal(
    providerUrl(PROVIDERS[0], { ...series, media_type: "tv" }, 0, 7),
    "https://vidlink.pro/tv/42/0/7",
  );
  assert.match(
    providerUrl(PROVIDERS[2], { ...movie, imdb_id: "tt123" }),
    /tt123$/,
  );
  for (const p of PROVIDERS)
    assert.ok(
      !providerUrl(p, { ...series, media_type: "tv" }, 2, 4).includes("{"),
    );
});
test("catalog proxy fixes upstream origin and blocks unrelated endpoints", () => {
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/account/1",
    "/movie/../account",
    "/movie/42?api_key=other",
  ])
    assert.throws(() =>
      buildUpstreamUrl(new URLSearchParams({ path }), "server-key"),
    );
  const url = buildUpstreamUrl(
    new URLSearchParams({
      path: "/discover/movie",
      api_key: "attacker",
      include_adult: "true",
      page: "9999",
      with_genres: "28",
    }),
    "server-key",
  );
  assert.equal(url.origin, "https://api.themoviedb.org");
  assert.equal(url.searchParams.get("api_key"), "server-key");
  assert.equal(url.searchParams.get("include_adult"), "false");
  assert.equal(url.searchParams.get("page"), "500");
  assert.equal(url.searchParams.get("with_genres"), "28");
});
test("catalog proxy accepts supported TV, movie and season routes", () => {
  for (const path of [
    "/movie/42",
    "/tv/42",
    "/tv/42/season/0",
    "/trending/all/week",
    "/discover/tv",
    "/movie/top_rated",
    "/tv/popular",
    "/search/multi",
  ])
    assert.doesNotThrow(() =>
      buildUpstreamUrl(new URLSearchParams({ path }), "key"),
    );
});
test("catalog proxy reports missing credentials and rejects writes", async () => {
  const previous = process.env.TMDB_API_KEY;
  delete process.env.TMDB_API_KEY;
  try {
    const res = {
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.code = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    await handler({ method: "GET", url: "/api/tmdb?path=/movie/popular" }, res);
    assert.equal(res.code, 503);
    assert.equal(res.data.code, "SETUP_REQUIRED");
    await handler({ method: "POST", url: "/api/tmdb" }, res);
    assert.equal(res.code, 405);
  } finally {
    if (previous) process.env.TMDB_API_KEY = previous;
  }
});

test("catalog proxy retries a transient network error and caches only success", async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test-server-key";
  let attempts = 0;
  globalThis.fetch = async (url) => {
    assert.equal(url.searchParams.get("api_key"), "test-server-key");
    if (++attempts === 1) throw new Error("Temporary connection reset");
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 1 }] }),
    };
  };
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  try {
    await handler({ method: "GET", url: "/api/tmdb?path=/movie/popular" }, res);
    assert.equal(attempts, 2);
    assert.equal(res.code, 200);
    assert.match(res.headers["Cache-Control"], /s-maxage=300/);
    assert.equal(JSON.stringify(res.data).includes("test-server-key"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey) process.env.TMDB_API_KEY = oldKey;
    else delete process.env.TMDB_API_KEY;
  }
});

test("playback restrictions default off and old profiles migrate once without losing library", () => {
  const storage = memory();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      watchlist: [movie],
      settings: { playerSandbox: true },
    }),
  );
  const store = createStore(storage);
  assert.equal(store.get().settings.playerSandbox, false);
  assert.equal(store.get().watchlist[0].id, movie.id);
  store.settings({ playerSandbox: true });
  assert.equal(createStore(storage).get().settings.playerSandbox, true);
  const restored = createStore(memory());
  restored.import(store.get());
  assert.equal(restored.get().settings.playerSandbox, true);
  assert.equal(createStore(memory()).get().settings.playerSandbox, false);
});

test("every provider can be saved as the preferred server", () => {
  const storage = memory();
  for (const provider of PROVIDERS) {
    const store = createStore(storage);
    store.settings({ defaultServer: provider.id });
    assert.equal(
      createStore(storage).get().settings.defaultServer,
      provider.id,
    );
  }
});

test("audio preferences use documented parameters only and retain episode selection", () => {
  const p = PROVIDERS.find((p) => p.id === "screenscape");
  const url = new URL(providerUrl(p, series, 0, 7, "hindi"));
  assert.equal(url.searchParams.get("lan"), "hindi");
  assert.equal(url.searchParams.get("s"), "0");
  assert.equal(url.searchParams.get("e"), "7");
  assert.equal(url.searchParams.get("tmdb"), String(series.id));
  assert.equal(
    new URL(providerUrl(p, movie, 1, 1, "auto")).searchParams.has("lan"),
    false,
  );
  assert.equal(
    new URL(providerUrl(p, movie, 1, 1, "invalid")).searchParams.has("lan"),
    false,
  );
  assert.equal(
    providerUrl(PROVIDERS[0], movie, 1, 1, "hindi"),
    providerUrl(PROVIDERS[0], movie),
  );
  const store = createStore(memory());
  store.settings({ audioLanguage: "hindi" });
  assert.equal(store.get().settings.audioLanguage, "hindi");
  store.settings({ audioLanguage: "invalid" });
  assert.equal(store.get().settings.audioLanguage, "auto");
});

test("production CSP permits every configured player host without wildcard frame access", async () => {
  const { readFile } = await import("node:fs/promises");
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  const csp = config.headers[0].headers.find(
    (h) => h.key === "Content-Security-Policy",
  ).value;
  const frames = csp.match(/frame-src ([^;]+)/)[1].split(" ");
  assert.equal(frames.includes("*"), false);
  for (const p of PROVIDERS)
    for (const media of [movie, series])
      assert.ok(frames.includes(new URL(providerUrl(p, media)).origin), p.id);
});
