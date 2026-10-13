import { PROVIDERS } from "./config.js";
export const STORAGE_KEY = "cinelocal_v2";
export const defaults = {
  name: "Ankit",
  defaultServer: "rivestream",
  compact: false,
  hideWatched: false,
  reducedMotion: false,
  rememberEpisode: true,
  playerSandbox: false,
  playbackDefaultsVersion: 1,
  audioLanguage: "auto",
  volume: 0.8,
};
export const mediaKey = (m) =>
  `${m.media_type === "tv" ? "tv" : "movie"}:${Number(m.id)}`;
const imagePath = (value) =>
  typeof value === "string" && /^\/[\w.-]+$/.test(value) ? value : null;
export function normalizeMedia(m) {
  if (!m || !Number.isSafeInteger(Number(m.id)) || Number(m.id) <= 0)
    return null;
  const media_type = m.media_type === "tv" || m.first_air_date ? "tv" : "movie";
  return {
    id: Number(m.id),
    media_type,
    title: String(m.title || m.name || "Untitled").slice(0, 250),
    poster_path: imagePath(m.poster_path),
    backdrop_path: imagePath(m.backdrop_path),
    overview: String(m.overview || "").slice(0, 5000),
    vote_average: Math.max(0, Math.min(10, Number(m.vote_average) || 0)),
    release_date: String(m.release_date || m.first_air_date || "").slice(0, 10),
    genre_ids: Array.isArray(m.genre_ids)
      ? m.genre_ids.filter(Number.isInteger)
      : Array.isArray(m.genres)
        ? m.genres.map((g) => g.id).filter(Number.isInteger)
        : [],
    addedAt: Number(m.addedAt) || Date.now(),
    season:
      Number.isInteger(Number(m.season)) && m.season != null
        ? Math.max(0, Number(m.season))
        : 1,
    episode: Math.max(1, Math.floor(Number(m.episode) || 1)),
  };
}
export function sanitizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("This is not a CineLocal backup.");
  const list = (name) => {
    const input = Array.isArray(value[name]) ? value[name] : [];
    const seen = new Set();
    return input
      .slice(0, 3000)
      .map(normalizeMedia)
      .filter((m) => m && !seen.has(mediaKey(m)) && seen.add(mediaKey(m)));
  };
  const settings = { ...defaults };
  const input = value.settings || {};
  for (const key of Object.keys(defaults))
    if (typeof input[key] === typeof defaults[key]) settings[key] = input[key];
  settings.name = settings.name.slice(0, 30);
  settings.volume = Math.max(0, Math.min(1, settings.volume));
  // One-time migration: old profiles inherited restrictions-on automatically.
  // Once migrated, keep any subsequent explicit choice across reloads/imports.
  if (input.playbackDefaultsVersion !== 1) settings.playerSandbox = false;
  settings.playbackDefaultsVersion = 1;
  if (!["auto", "hindi", "eng"].includes(settings.audioLanguage))
    settings.audioLanguage = "auto";
  if (!PROVIDERS.some((p) => p.id === settings.defaultServer))
    settings.defaultServer = defaults.defaultServer;
  const ratings = {};
  for (const [key, rating] of Object.entries(value.ratings || {}))
    if (
      /^(movie|tv):\d+$/.test(key) &&
      Number.isInteger(rating) &&
      rating >= 1 &&
      rating <= 5
    )
      ratings[key] = rating;
  return {
    version: 2,
    watchlist: list("watchlist"),
    history: list("history").slice(0, 100),
    watched: list("watched"),
    ratings,
    settings,
  };
}
export function createStore(storage, notify = () => {}) {
  let state;
  let issue = "";
  try {
    const raw = storage.getItem(STORAGE_KEY);
    state = raw ? sanitizeState(JSON.parse(raw)) : null;
  } catch {
    issue =
      "Saved data could not be read. A fresh session is available; your original storage has not been overwritten.";
  }
  if (!state) {
    const legacy = (name) => {
      try {
        const v = JSON.parse(storage.getItem(`cinelocal_${name}`) || "[]");
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    };
    state = sanitizeState({
      watchlist: legacy("watchlist"),
      history: legacy("history"),
    });
  }
  const persist = (next) => {
    const previous = state;
    state = next;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      issue = "";
    } catch {
      state = previous;
      throw new Error(
        "Browser storage is full or unavailable. Export your library before clearing space.",
      );
    }
    notify(state);
    return state;
  };
  return {
    get: () => structuredClone(state),
    getIssue: () => issue,
    has: (list, m) => state[list].some((x) => mediaKey(x) === mediaKey(m)),
    toggle(list, m) {
      if (!["watchlist", "watched"].includes(list)) return;
      const item = normalizeMedia(m);
      if (!item) return;
      const next = structuredClone(state);
      const index = next[list].findIndex((x) => mediaKey(x) === mediaKey(item));
      if (index >= 0) next[list].splice(index, 1);
      else next[list].unshift(item);
      persist(next);
      return index < 0;
    },
    remember(m, progress = {}) {
      const item = normalizeMedia({ ...m, ...progress, addedAt: Date.now() });
      if (!item) return;
      const next = structuredClone(state);
      next.history = [
        item,
        ...next.history.filter((x) => mediaKey(x) !== mediaKey(item)),
      ].slice(0, 100);
      persist(next);
    },
    remove(list, key) {
      if (!["watchlist", "history", "watched"].includes(list)) return;
      const next = structuredClone(state);
      next[list] = next[list].filter((m) => mediaKey(m) !== key);
      persist(next);
    },
    settings(patch) {
      persist(
        sanitizeState({ ...state, settings: { ...state.settings, ...patch } }),
      );
    },
    rate(m, rating) {
      const next = structuredClone(state);
      if (rating) next.ratings[mediaKey(m)] = rating;
      else delete next.ratings[mediaKey(m)];
      persist(sanitizeState(next));
    },
    clearHistory() {
      persist({ ...state, history: [] });
    },
    import(value) {
      if (
        value.version !== 2 ||
        !Array.isArray(value.watchlist) ||
        !Array.isArray(value.history) ||
        !Array.isArray(value.watched)
      )
        throw new Error("Choose a valid CineLocal v2 backup.");
      persist(sanitizeState(value));
    },
    refresh() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) {
          state = sanitizeState(JSON.parse(raw));
          notify(state);
        }
      } catch {}
    },
  };
}
