import { request, details, season } from "./api.js";
import { PROVIDERS, GENRES, providerUrl } from "./config.js";
import { createStore, mediaKey, normalizeMedia } from "./store.js";
import { previewCatalog } from "./demo.js";
import { icon } from "./icons.js";
import {
  escape as esc,
  imageUrl,
  title,
  year,
  rating,
  typeLabel,
  card,
  row,
  empty,
  skeleton,
  toast,
  genreNames,
  downloadJSON,
  timeLabel,
} from "./ui.js";

const $ = (s) => document.querySelector(s);
const main = $("#main"),
  detailDialog = $("#details-dialog"),
  watchDialog = $("#watch-dialog");
const media = new Map(previewCatalog.map((m) => [mediaKey(m), m]));
const store = createStore(
  {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  },
  () => {
    applyPreferences();
    syncLibraryUI();
  },
);
let route = "home",
  routeParams = new URLSearchParams(),
  routeController,
  routeVersion = 0,
  homeData = null,
  searchTimer,
  heroIndex = 0,
  heroItems = [],
  page = 1,
  totalPages = 1,
  results = [],
  loadingMore = false;
let active = null,
  detailController,
  seasonController,
  detailVersion = 0,
  seasonVersion = 0,
  returnFocus = null,
  playerMedia = null,
  playerMode = "stream",
  localURL = null,
  subtitleURL = null,
  localFile = null,
  localResumeKey = "",
  sleepTimer = null;
const currentSettings = () => store.get().settings;
const indexMedia = (items) => {
  items.forEach((m) => media.set(mediaKey(m), m));
  return items;
};
const normalizeResults = (items, type) =>
  indexMedia(
    (items || [])
      .filter((m) => m.media_type !== "person")
      .map((m) => ({ ...m, media_type: m.media_type || type || "movie" })),
  );
const visible = (items) =>
  currentSettings().hideWatched
    ? items.filter((m) => !store.has("watched", m))
    : items;
const guard =
  (fn) =>
  (...args) =>
    Promise.resolve()
      .then(() => fn(...args))
      .catch((error) => {
        if (error.name !== "AbortError")
          toast(
            error.message || "Something went wrong. Please try again.",
            "error",
          );
      });
const navigate = (name, params = {}) => {
  clearTimeout(searchTimer);
  const qs = new URLSearchParams(params).toString();
  const next = `#${name}${qs ? "?" + qs : ""}`;
  if (location.hash === next) renderRoute();
  else location.hash = next;
};

function renderShell() {
  const nav = (id, label, symbol, count) =>
    `<button class="nav-item" data-action="navigate" data-route="${id}" title="${label}">${icon(symbol)}<span>${label}</span>${count ? `<small class="nav-count" data-count="${id}">${store.get()[id].length}</small>` : ""}</button>`;
  $("#sidebar").innerHTML =
    `<a class="brand" href="#home" aria-label="CineLocal home"><img src="/favicon.svg" alt=""><span>Cine<span class="brand-light">Local</span></span></a><p class="brand-tag">Your personal cinema</p><nav><p class="nav-label">EXPLORE</p>${nav("home", "For you", "home")}${nav("discover", "Discover", "compass")}${nav("movies", "Movies", "film")}${nav("series", "TV series", "tv")}<p class="nav-label">YOUR SPACE</p>${nav("watchlist", "Watchlist", "bookmark", true)}${nav("history", "Recently watched", "history")}${nav("watched", "Completed", "check")}${nav("local", "Local player", "folder")}</nav><div class="nav-bottom"><div class="personal-card">${icon("spark")}<h3>Your next great watch.</h3><p>Let a little serendipity pick<br>tonight’s story.</p><button data-action="surprise">Surprise me ${icon("arrow")}</button></div>${nav("settings", "Settings", "settings")}<button class="nav-item" data-action="shortcuts" title="Keyboard shortcuts">${icon("grid")}<span>Keyboard shortcuts</span></button><div class="sidebar-foot"><span class="status-dot"></span> MADE FOR YOUR MOVIE NIGHTS</div></div>`;
  $("#topbar").innerHTML =
    `<button class="icon-button mobile-menu" data-action="menu" aria-label="Toggle navigation" aria-expanded="false">${icon("menu")}</button><div class="top-tabs"><button class="top-tab" data-action="navigate" data-route="home">Discover</button><button class="top-tab" data-action="navigate" data-route="movies">Movies</button><button class="top-tab" data-action="navigate" data-route="series">TV series</button></div><form class="search-box" id="search-form" role="search">${icon("search")}<input id="search-input" type="search" placeholder="Search movies, series, and more" aria-label="Search movies and series" autocomplete="off"><button class="search-clear hidden" type="button" data-action="clear-search" aria-label="Clear search">${icon("close")}</button><kbd>/</kbd></form><div class="top-actions"><button class="icon-button" data-action="surprise" title="Surprise me" aria-label="Pick a random title">${icon("shuffle")}</button><button class="avatar" data-action="navigate" data-route="settings" aria-label="Profile settings">A</button></div>`;
  $("#shortcuts-dialog").innerHTML =
    `<button class="icon-button dialog-close" data-action="close-shortcuts" aria-label="Close shortcuts">${icon("close")}</button><p class="eyebrow">A few little shortcuts</p><h2 id="shortcut-title">Make yourself at home.</h2>${[
      ["Search", "/"],
      ["Close dialog", "Esc"],
      ["Show shortcuts", "?"],
      ["Play / pause local video", "Space"],
      ["Seek local video", "← / →"],
      ["Mute local video", "M"],
      ["Fullscreen player", "F"],
    ]
      .map(
        ([label, key]) =>
          `<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`,
      )
      .join(
        "",
      )}<p class="shortcut-note">Playback shortcuts work in the local player. Embedded providers handle their own keyboard controls.</p>`;
  applyPreferences();
}
function applyPreferences() {
  const s = currentSettings();
  document.body.classList.toggle("compact", s.compact);
  document.body.classList.toggle("reduced-motion", s.reducedMotion);
  const avatar = $(".avatar");
  if (avatar) {
    avatar.textContent = (s.name || "You")[0].toUpperCase();
    avatar.title = s.name || "Your profile";
  }
}
function syncLibraryUI() {
  const state = store.get();
  for (const list of ["watchlist", "history", "watched"]) {
    indexMedia(state[list]);
    document
      .querySelectorAll(`[data-count="${list}"]`)
      .forEach((el) => (el.textContent = state[list].length));
  }
  document.querySelectorAll('[data-action="save"]').forEach((button) => {
    const m = media.get(button.dataset.key);
    if (!m) return;
    const saved = store.has("watchlist", m);
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute(
      "aria-label",
      `${saved ? "Remove from" : "Add to"} watchlist: ${title(m)}`,
    );
    button.innerHTML =
      icon(saved ? "check" : "plus") +
      (button.classList.contains("button")
        ? ` ${saved ? "In watchlist" : "Watchlist"}`
        : "");
  });
  document.querySelectorAll('[data-action="watched"]').forEach((button) => {
    const m = media.get(button.dataset.key);
    if (m)
      button.innerHTML =
        icon("check") +
        ` ${store.has("watched", m) ? "Completed" : "Mark watched"}`;
  });
  if (["watchlist", "history", "watched"].includes(route)) renderLibrary();
  if (route === "home" && homeData) renderHome();
}
function updateNavigation() {
  document.querySelectorAll("[data-route]").forEach((el) => {
    if (el.classList.contains("nav-item") || el.classList.contains("top-tab")) {
      const selected = el.dataset.route === route;
      el.classList.toggle("active", selected);
      if (selected) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    }
  });
  $("#sidebar").classList.remove("mobile-open");
  $(".mobile-menu").setAttribute("aria-expanded", "false");
  const input = $("#search-input");
  if (document.activeElement !== input)
    input.value = route === "search" ? routeParams.get("q") || "" : "";
  $(".search-clear").classList.toggle("hidden", !input.value);
}
async function renderRoute() {
  routeController?.abort();
  routeController = new AbortController();
  const version = ++routeVersion;
  const [name, query = ""] = location.hash.slice(1).split("?");
  route = [
    "home",
    "discover",
    "movies",
    "series",
    "watchlist",
    "history",
    "watched",
    "settings",
    "local",
    "search",
  ].includes(name)
    ? name
    : "home";
  routeParams = new URLSearchParams(query);
  updateNavigation();
  document.title = `${{ home: "Your personal cinema", discover: "Discover", movies: "Movies", series: "TV series", watchlist: "Your watchlist", history: "Recently watched", watched: "Completed", settings: "Settings", local: "Local player", search: "Search" }[route]} — CineLocal`;
  if (route === "home") {
    if (homeData) {
      renderHome();
      return;
    }
    main.innerHTML = `${greeting()}<div class="hero"><div class="initial-loading" style="width:100%"><span class="loading-orbit"></span><p>Finding your next great story…</p></div></div><div class="shelf">${skeleton()}</div>`;
    await loadHome(version);
  } else if (["discover", "movies", "series", "search"].includes(route)) {
    page = 1;
    results = [];
    renderCatalogShell();
    await loadCatalog(version);
  } else if (["watchlist", "history", "watched"].includes(route))
    renderLibrary();
  else if (route === "settings") renderSettings();
  else renderLocal();
}
function greeting() {
  const s = currentSettings();
  return `<div class="greeting"><div><p class="eyebrow">YOUR FRONT ROW SEAT</p><h1>A world of stories<span>.</span></h1><p class="greeting-sub">Welcome back, ${esc(s.name || "movie lover")}. What are we watching tonight?</p></div><span class="date-label">${icon("clock")} YOUR TIME. YOUR CINEMA.</span></div>`;
}
async function loadHome(version) {
  const signal = routeController.signal;
  const specs = [
    ["trending", "/trending/all/week", null],
    ["movies", "/movie/popular", "movie"],
    ["series", "/tv/popular", "tv"],
    ["rated", "/movie/top_rated", "movie"],
  ];
  const response = await Promise.allSettled(
    specs.map(([, path]) => request(path, {}, { signal })),
  );
  if (version !== routeVersion) return;
  const data = {
    preview: false,
    partial: false,
    error: "",
    sections: {},
    fallback: [],
  };
  response.forEach((result, i) => {
    const [key, , type] = specs[i];
    if (result.status === "fulfilled")
      data.sections[key] = normalizeResults(result.value.results, type);
    else {
      data.sections[key] = previewCatalog.filter(
        (m) => !type || m.media_type === type,
      );
      data.partial = true;
      data.fallback.push(key);
      data.error = result.reason.message;
    }
  });
  data.preview = response.every((r) => r.status === "rejected");
  homeData = data;
  heroItems = data.sections.movies.filter((m) => m.backdrop_path).slice(0, 5);
  if (!heroItems.length) heroItems = previewCatalog.slice(0, 5);
  heroIndex = 0;
  renderHome();
}
function previewNotice(
  message = "The live catalog is unavailable. You’re viewing a preview collection; your library and local player still work.",
) {
  return `<div class="notice">${icon("info")}<span>${esc(message)}</span><button data-action="retry">Retry live catalog</button></div>`;
}
function heroMarkup() {
  const m = heroItems[heroIndex] || previewCatalog[0];
  media.set(mediaKey(m), m);
  const saved = store.has("watchlist", m);
  return `<section class="hero" aria-label="Featured title"><img class="hero-image" data-fallback="${imageUrl(m.poster_path, "w780")}" src="${imageUrl(m.backdrop_path, "w1280")}" alt="" fetchpriority="high"><div class="hero-bottom-label">${icon("spark")} THE CINELOCAL SPOTLIGHT</div><div class="hero-content"><div class="hero-kicker">${icon("spark")} Tonight deserves a great story</div><h2>${esc(title(m))}</h2><p class="hero-tagline">${esc(genreNames(m) || "A story worth your time")}</p><div class="hero-meta"><span class="rating">${icon("star")}${rating(m)}</span><span>${year(m)}</span><span>${typeLabel(m)}</span><span class="quality-tag">${m.media_type === "tv" ? "SERIES" : "FEATURE FILM"}</span></div><p class="hero-description">${esc(m.overview || "Find your next favorite. Explore the story, save it for later, or settle in and press play.")}</p><div class="hero-actions"><button class="button primary" data-action="play" data-key="${mediaKey(m)}">${icon("play")} Watch now</button><button class="button" data-action="save" data-key="${mediaKey(m)}" aria-pressed="${saved}">${icon(saved ? "check" : "plus")}${saved ? "In watchlist" : "Watchlist"}</button><button class="button" data-action="details" data-key="${mediaKey(m)}">${icon("info")} Details</button></div></div><div class="hero-pagination"><span class="hero-index">0${heroIndex + 1} <span style="opacity:.45">/ 0${heroItems.length}</span></span>${heroItems.map((_, i) => `<button data-action="hero" data-index="${i}" class="${i === heroIndex ? "active" : ""}" aria-label="Show featured title ${i + 1}" aria-pressed="${i === heroIndex}"></button>`).join("")}</div></section>`;
}
function renderHome() {
  const s = store.get(),
    d = homeData;
  indexMedia([...s.history, ...s.watchlist]);
  main.innerHTML = `${greeting()}${d.preview ? previewNotice() : d.partial ? previewNotice("Some catalog sections could not load. Those sections show preview titles.") : ""}${heroMarkup()}<div class="genre-strip" aria-label="Browse by genre"><button class="genre-chip active" data-action="navigate" data-route="discover">${icon("grid")} All stories</button>${[
    [28, "Action"],
    [12, "Adventure"],
    [35, "Comedy"],
    [18, "Drama"],
    [878, "Sci-Fi"],
    [53, "Thriller"],
    [16, "Animation"],
    [27, "Horror"],
  ]
    .map(
      ([id, label]) =>
        `<button class="genre-chip" data-action="genre" data-genre="${id}">${label}</button>`,
    )
    .join("")}</div>
 ${s.history.length ? row("Pick up where you left off", "YOUR RECENT STORIES", s.history.slice(0, 9), store, { id: "continue-row", landscape: true, more: "history", removeFrom: "history" }) : ""}
 ${row(d.fallback.includes("trending") ? "The conversation starters" : "Trending this week", d.fallback.includes("trending") ? "PREVIEW COLLECTION" : "WHAT’S CAPTURING EVERYONE", visible(d.sections.trending).slice(0, 12), store, { id: "trending-row", ranked: true, more: "discover" })}
 ${s.watchlist.length ? row("Saved for a good night", "YOUR WATCHLIST", s.watchlist.slice(0, 12), store, { id: "watchlist-row", more: "watchlist", count: s.watchlist.length }) : ""}
 <section class="feature-banner"><div><p class="eyebrow">LESS SCROLLING. MORE CINEMA.</p><h2>Can’t decide? Leave it to us.</h2><p>One unexpected pick. It might just become your next favorite.</p></div><button class="button primary" data-action="surprise">${icon("shuffle")} Find my next watch</button></section>
 ${row("Made for the big screen", d.fallback.includes("movies") ? "PREVIEW · MOVIES TO GET LOST IN" : "POPULAR MOVIES", visible(d.sections.movies).slice(0, 12), store, { id: "movies-row", more: "movies" })}
 ${row("Just one more episode", d.fallback.includes("series") ? "PREVIEW · SERIES WORTH YOUR TIME" : "POPULAR TV SERIES", visible(d.sections.series).slice(0, 12), store, { id: "series-row", more: "series" })}
 ${row("Great stories stay with you", d.fallback.includes("rated") ? "PREVIEW · THE ESSENTIAL COLLECTION" : "TOP-RATED CINEMA", visible(d.sections.rated).slice(0, 12), store, { id: "rated-row", more: "discover" })}`;
}
function filtersMarkup() {
  const type = route === "series" ? "tv" : routeParams.get("type") || "movie";
  const genres = Object.entries(GENRES).filter(([id]) =>
    type === "tv"
      ? ![28, 12, 14, 878, 10749, 53, 10752, 10770].includes(+id)
      : ![10759, 10765, 10764, 10768].includes(+id),
  );
  const select = (name, label, options, value) =>
    `<label class="filter-field"><span>${label}</span><select data-filter="${name}">${options.map(([v, l]) => `<option value="${v}" ${String(value) === String(v) ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  const years = Array.from(
    { length: 45 },
    (_, i) => new Date().getFullYear() - i,
  );
  return `<div class="filter-panel">${
    route === "discover"
      ? select(
          "type",
          "Format",
          [
            ["movie", "Movies"],
            ["tv", "TV series"],
          ],
          type,
        )
      : ""
  }${select("genre", "Genre", [["", "All genres"], ...genres], routeParams.get("genre") || "")}${select("year", "Release year", [["", "All years"], ...years.map((y) => [y, y])], routeParams.get("year") || "")}${select(
    "language",
    "Language",
    [
      ["", "All languages"],
      ["en", "English"],
      ["hi", "Hindi"],
      ["ko", "Korean"],
      ["ja", "Japanese"],
      ["ta", "Tamil"],
      ["te", "Telugu"],
      ["ml", "Malayalam"],
      ["fr", "French"],
      ["es", "Spanish"],
    ],
    routeParams.get("language") || "",
  )}${select(
    "rating",
    "Min. rating",
    [
      ["", "Any rating"],
      ["6", "6+ · Worth a look"],
      ["7", "7+ · Highly rated"],
      ["8", "8+ · Exceptional"],
    ],
    routeParams.get("rating") || "",
  )}${select(
    "sort",
    "Sort by",
    [
      ["popularity.desc", "Popular"],
      ["vote_average.desc", "Top rated"],
      ["primary_release_date.desc", "Newest"],
    ],
    routeParams.get("sort") || "popularity.desc",
  )}<button class="button subtle" data-action="reset-filters">Reset</button></div>`;
}
function renderCatalogShell() {
  const searching = route === "search";
  const heading = searching
    ? "Find your next favorite."
    : route === "movies"
      ? "For the love of movies."
      : route === "series"
        ? "Your next obsession."
        : "Follow your curiosity.";
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${searching ? "THE SEARCH IS PART OF THE STORY" : "A WHOLE WORLD TO EXPLORE"}</p><h1>${heading}</h1><p>${searching ? `Results for “${esc(routeParams.get("q") || "")}”` : route === "series" ? "Big stories. Unforgettable characters. One more episode." : "From familiar favorites to unexpected discoveries. Make it your own."}</p></div></div>${searching ? "" : filtersMarkup()}<div id="catalog-status"></div><div class="grid-topline"><span id="result-count">Finding stories…</span><span>${icon("grid")} Your cinema, curated by you</span></div><div id="catalog-grid">${skeleton(12)}</div><div class="load-more" id="load-more"></div>`;
}
function previewResults() {
  let list = previewCatalog;
  const q = (routeParams.get("q") || "").toLowerCase();
  const type = route === "series" ? "tv" : routeParams.get("type") || "movie";
  if (route === "search")
    list = list.filter((m) => title(m).toLowerCase().includes(q));
  else list = list.filter((m) => m.media_type === type);
  const g = routeParams.get("genre"),
    y = routeParams.get("year"),
    r = routeParams.get("rating"),
    language = routeParams.get("language");
  if (g) list = list.filter((m) => m.genre_ids.includes(+g));
  if (y) list = list.filter((m) => year(m) === y);
  if (r) list = list.filter((m) => m.vote_average >= +r);
  if (language)
    list = list.filter(
      (m) => ([129, 1429].includes(m.id) ? "ja" : "en") === language,
    );
  if (routeParams.get("sort") === "vote_average.desc")
    list = [...list].sort((a, b) => b.vote_average - a.vote_average);
  if (routeParams.get("sort") === "primary_release_date.desc")
    list = [...list].sort((a, b) =>
      b.release_date.localeCompare(a.release_date),
    );
  return list;
}
async function loadCatalog(version, append = false) {
  const signal = routeController.signal;
  loadingMore = true;
  const type =
    route === "series"
      ? "tv"
      : route === "movies"
        ? "movie"
        : routeParams.get("type") || "movie";
  const query = routeParams.get("q") || "";
  let data,
    preview = false;
  try {
    if (route === "search") {
      if (query.length < 2) {
        $("#catalog-grid").innerHTML = empty(
          "A little more to go on…",
          "Type at least two characters to search movies and series.",
          "",
        );
        $("#result-count").textContent = "Search the catalog";
        return;
      }
      data = await request("/search/multi", { query, page }, { signal });
    } else {
      const sort = routeParams.get("sort") || "popularity.desc";
      data = await request(
        `/discover/${type}`,
        {
          page,
          sort_by:
            type === "tv"
              ? sort.replace("primary_release_date", "first_air_date")
              : sort,
          with_genres: routeParams.get("genre"),
          [type === "tv" ? "first_air_date_year" : "primary_release_year"]:
            routeParams.get("year"),
          with_original_language: routeParams.get("language"),
          "vote_average.gte": routeParams.get("rating"),
          "vote_count.gte": sort === "vote_average.desc" ? 200 : 20,
        },
        { signal },
      );
    }
  } catch (error) {
    if (version !== routeVersion || error.name === "AbortError") return;
    if (append) {
      page = Math.max(1, page - 1);
      toast("Could not load more titles. Try again.", "error");
      return;
    }
    preview = true;
    const list = previewResults();
    data = { results: list, total_results: list.length, total_pages: 1 };
  } finally {
    if (version === routeVersion) loadingMore = false;
  }
  if (version !== routeVersion) return;
  const items = normalizeResults(data.results, type);
  results = append
    ? [
        ...results,
        ...items.filter(
          (m) => !results.some((x) => mediaKey(x) === mediaKey(m)),
        ),
      ]
    : items;
  totalPages = Math.min(500, data.total_pages || 1);
  $("#catalog-status").innerHTML = preview ? previewNotice() : "";
  const displayed = visible(results);
  $("#result-count").textContent =
    `${displayed.length} ${preview ? "preview " : ""}titles${!preview && totalPages > 1 ? " · more to explore" : ""}`;
  $("#catalog-grid").className = displayed.length ? "card-grid" : "";
  $("#catalog-grid").innerHTML = displayed.length
    ? displayed.map((m) => card(m, store)).join("")
    : empty(
        "No stories found just yet.",
        preview
          ? "This search is limited to the preview collection. Reconnect the live catalog for more titles."
          : "Try a different search or loosen a filter.",
        "Reset your discovery",
        "discover",
        "search",
      );
  $("#load-more").innerHTML =
    page < totalPages
      ? '<button class="button subtle" data-action="load-more">Explore more titles</button>'
      : "";
}
function renderLibrary() {
  const state = store.get();
  const list = state[route];
  indexMedia(list);
  const labels = {
    watchlist: [
      "The good stuff, saved.",
      "Your watchlist",
      "Keep a little anticipation on the shelf.",
    ],
    history: [
      "Your story so far.",
      "Recently watched",
      "Recently opened titles and the last episode you selected.",
    ],
    watched: [
      "That’s a wrap.",
      "Completed",
      "The stories you’ve marked as watched.",
    ],
  };
  const [heading, kicker, description] = labels[route];
  const filter = routeParams.get("type") || "all";
  const sorted = [...list].filter(
    (m) => filter === "all" || m.media_type === filter,
  );
  if (routeParams.get("sort") === "title")
    sorted.sort((a, b) => title(a).localeCompare(title(b)));
  else if (routeParams.get("sort") === "rating")
    sorted.sort((a, b) => b.vote_average - a.vote_average);
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${kicker.toUpperCase()}</p><h1>${heading}</h1><p>${description}</p></div><button class="button subtle" data-action="export">${icon("download")} Export library</button></div><div class="library-tabs">${[
    ["all", "All titles"],
    ["movie", "Movies"],
    ["tv", "TV series"],
  ]
    .map(
      ([v, label]) =>
        `<button class="${filter === v ? "active" : ""}" data-action="library-filter" data-type="${v}">${label} <span style="opacity:.6">${list.filter((m) => v === "all" || m.media_type === v).length}</span></button>`,
    )
    .join(
      "",
    )}</div><div class="grid-topline"><span>${sorted.length} ${sorted.length === 1 ? "story" : "stories"} in your collection</span><label>Sort <select data-library-sort aria-label="Sort library"><option value="recent">Recently added</option><option value="title" ${routeParams.get("sort") === "title" ? "selected" : ""}>Title A–Z</option><option value="rating" ${routeParams.get("sort") === "rating" ? "selected" : ""}>Rating</option></select></label></div>${sorted.length ? `<div class="card-grid">${sorted.map((m) => card(m, store, { removeFrom: route })).join("")}</div>` : empty(route === "watchlist" ? "Your next chapter starts here." : route === "history" ? "Make tonight a movie night." : "Some stories stay with you.", route === "watchlist" ? "Tap + on any title to save it. Your watchlist is always one click away." : route === "history" ? "Open a title and press play. Your recent stories will appear here." : "Mark a title as watched in its details to build your completed collection.")}<p class="settings-note">Your library is saved in this browser. Export a backup to take it to another device.${route === "history" ? " Embedded players do not share exact playback positions with CineLocal." : ""}</p>`;
}
function renderSettings() {
  const state = store.get(),
    s = state.settings;
  const toggle = (key, label, help) =>
    `<label class="setting-row"><span><strong>${label}</strong><small>${help}</small></span><input type="checkbox" data-setting="${key}" ${s[key] ? "checked" : ""}></label>`;
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MAKE IT YOURS</p><h1>A cinema on your terms.</h1><p>A few thoughtful preferences for a better movie night.</p></div></div><div class="settings-grid"><div class="settings-stack"><section class="settings-card"><h2>${icon("settings")} Your experience</h2><p>These preferences stay with this browser and travel with your library backup.</p><label class="setting-row"><span><strong>What should we call you?</strong><small>Your own little corner of cinema.</small></span><input class="name-input" data-setting="name" value="${esc(s.name)}" maxlength="30" aria-label="Your name"></label>${toggle("compact", "Compact browsing", "Fit more stories on your screen.")}${toggle("hideWatched", "Hide completed titles", "Keep discovery fresh. Your library stays intact.")}${toggle("reducedMotion", "Reduce motion", "A calmer interface with fewer animations.")}</section><section class="settings-card"><h2>${icon("play")} Playback preferences</h2><label class="setting-row"><span><strong>Preferred server</strong><small>Start embedded playback with this provider.</small></span><select data-setting="defaultServer" aria-label="Preferred server">${PROVIDERS.map((p) => `<option value="${p.id}" ${s.defaultServer === p.id ? "selected" : ""}>${p.name}</option>`).join("")}</select></label>${toggle("rememberEpisode", "Remember selected episodes", "Reopen a series at the last episode you chose.")}${toggle("playerSandbox", "Restrict embedded players", "Block popups and top-page navigation. Some providers may need this disabled.")}<p class="settings-note">Embedded providers supply their own quality, audio, subtitle and timeline controls. Availability depends on the provider. CineLocal does not host video.</p></section></div><div class="settings-stack"><section class="settings-card"><h2>${icon("bookmark")} Your library, your data</h2><div class="stat-row"><div class="stat"><b>${state.watchlist.length}</b><span>Saved for later</span></div><div class="stat"><b>${state.watched.length}</b><span>Completed</span></div><div class="stat"><b>${state.history.length}</b><span>Recent titles</span></div></div><div class="settings-buttons"><button class="button primary" data-action="export">${icon("download")} Export backup</button><button class="button subtle" data-action="import">${icon("upload")} Import backup</button></div><p class="settings-note">Backups include your lists, ratings and preferences. Importing replaces the current library after confirmation. There is no cloud sync or account system.</p></section><section class="settings-card"><h2>${icon("history")} A fresh start</h2><p>Clear recent titles while keeping your watchlist, completed titles and preferences.</p><button class="button danger" data-action="clear-history">${icon("trash")} Clear viewing history</button></section><section class="settings-card"><h2>${icon("info")} CineLocal 2.0</h2><p>Built for your own front row seat. Catalog metadata and artwork are provided by TMDB.</p><div class="settings-buttons"><button class="button subtle" data-action="connection">Check catalog connection</button><button class="button subtle" data-action="shortcuts">Keyboard shortcuts</button></div><p class="settings-note">Your collection lives in this browser. Keep a backup before clearing browser data or moving to a new device.</p></section></div></div>`;
}
function renderLocal() {
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">YOUR FILES. YOUR SCREEN.</p><h1>Bring your own movie night.</h1><p>A private player for the videos already on your device.</p></div></div><section class="local-drop" id="local-drop">${icon("folder")}<h2>Drop a film. Settle in.</h2><p>Open a video from your device. It plays right here, without being uploaded anywhere.</p><button class="button primary" data-action="choose-video">${icon("plus")} Choose a video</button><p style="font-size:10px;margin-bottom:0">MP4, WebM and other formats supported by your browser</p></section><div class="local-features"><article class="local-feature">${icon("play")}<h3>Every little control</h3><p>Play, pause, seek, adjust volume and speed, enter fullscreen or picture-in-picture.</p></article><article class="local-feature">${icon("film")}<h3>Read between the lines</h3><p>Load a matching SRT or WebVTT subtitle file. Choose a file from your own device.</p></article><article class="local-feature">${icon("history")}<h3>A little memory</h3><p>Reopen the same file to resume your last position. Your video stays on your device.</p></article></div>`;
}

async function openDetails(key, autoplay = false) {
  const m = media.get(key);
  if (!m) return;
  detailController?.abort();
  seasonController?.abort();
  detailController = new AbortController();
  const version = ++detailVersion;
  ++seasonVersion;
  if (!detailDialog.open) {
    returnFocus = document.activeElement;
    detailDialog.showModal();
  }
  const remembered = currentSettings().rememberEpisode
    ? store.get().history.find((x) => mediaKey(x) === key)
    : null;
  active = {
    m: { ...m },
    season: remembered?.season ?? 1,
    episode: remembered?.episode ?? 1,
    episodes: [],
    tab: m.media_type === "tv" ? "episodes" : "similar",
    loaded: false,
  };
  renderDetails(true);
  try {
    const d = await details(m.media_type, m.id, detailController.signal);
    if (version !== detailVersion) return;
    active.m = {
      ...m,
      ...d,
      title: d.title || d.name || title(m),
      media_type: m.media_type,
    };
    active.loaded = true;
    media.set(key, active.m);
  } catch (error) {
    if (version !== detailVersion || error.name === "AbortError") return;
    active.error =
      "Live details are unavailable. You can still save this title or try a streaming server.";
  }
  if (version !== detailVersion || !detailDialog.open) return;
  renderDetails();
  if (active.m.media_type === "tv" && active.loaded)
    await loadSeason(active.season, version);
  if (autoplay && version === detailVersion && detailDialog.open)
    await startStream();
}
function renderDetails(loading = false) {
  if (!active) return;
  const m = active.m,
    key = mediaKey(m),
    saved = store.has("watchlist", m),
    watched = store.has("watched", m),
    stars = store.get().ratings[key] || 0;
  const cast = m.credits?.cast
    ?.slice(0, 6)
    .map((p) => p.name)
    .join(", ");
  const director =
    m.credits?.crew?.find((p) => p.job === "Director")?.name ||
    m.created_by?.map((p) => p.name).join(", ");
  const runtime = m.runtime
    ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m`
    : m.number_of_seasons
      ? `${m.number_of_seasons} seasons`
      : typeLabel(m);
  detailDialog.innerHTML = `<button class="icon-button dialog-close" data-action="close-details" aria-label="Close title details">${icon("close")}</button><div class="detail-backdrop">${m.backdrop_path ? `<img src="${imageUrl(m.backdrop_path, "w1280")}" alt="">` : ""}</div><div class="detail-body"><div class="detail-head">${m.poster_path ? `<img class="detail-poster" src="${imageUrl(m.poster_path, "w342")}" alt="${esc(title(m))} poster">` : ""}<div class="detail-heading"><p class="eyebrow">${esc(genreNames(m) || typeLabel(m))}</p><h2 id="detail-title">${esc(title(m))}</h2>${m.tagline ? `<p class="detail-tagline">${esc(m.tagline)}</p>` : ""}<div class="hero-meta"><span class="rating">${icon("star")}${rating(m)} TMDB</span><span>${year(m)}</span><span>${esc(runtime)}</span>${m.status ? `<span>${esc(m.status)}</span>` : ""}</div><div class="hero-actions"><button class="button primary" data-action="start-stream" ${loading ? "disabled" : ""}>${icon("play")} ${m.media_type === "tv" ? `Play S${active.season} E${active.episode}` : "Watch now"}</button><button class="button" data-action="save" data-key="${key}" aria-pressed="${saved}">${icon(saved ? "check" : "plus")}${saved ? "In watchlist" : "Watchlist"}</button><button class="button" data-action="trailer" ${loading ? "disabled" : ""}>${icon("film")} Trailer</button></div></div></div><p class="detail-overview">${esc(m.overview || "No overview available for this title.")}</p>${director ? `<p class="detail-credits"><strong>${m.media_type === "tv" ? "Created by" : "Director"}</strong> ${esc(director)}</p>` : ""}${cast ? `<p class="detail-credits"><strong>Starring</strong> ${esc(cast)}</p>` : ""}<div class="hero-actions" style="margin-top:15px"><button class="button subtle" data-action="watched" data-key="${key}">${icon("check")}${watched ? "Completed" : "Mark watched"}</button><button class="button subtle" data-action="copy-link" data-key="${key}">${icon("external")} Share title</button></div><div class="your-rating"><span>Your rating</span>${[1, 2, 3, 4, 5].map((n) => `<button class="rating-star ${n <= stars ? "selected" : ""}" data-action="rate" data-rating="${n}" aria-label="Rate ${n} out of 5" aria-pressed="${n === stars}">${icon("star")}</button>`).join("")}${stars ? '<button class="text-button" data-action="rate" data-rating="0">Clear</button>' : ""}</div>${active.error ? `<div class="notice" style="margin-top:20px">${icon("info")}<span>${esc(active.error)}</span><button data-action="retry-details">Retry</button></div>` : ""}${loading ? '<div class="initial-loading" style="min-height:100px"><span class="loading-orbit"></span><p>Loading the full story…</p></div>' : `<div class="detail-tabs" role="tablist">${m.media_type === "tv" ? `<button class="detail-tab ${active.tab === "episodes" ? "active" : ""}" data-action="detail-tab" data-tab="episodes" role="tab" aria-selected="${active.tab === "episodes"}">Episodes</button>` : ""}<button class="detail-tab ${active.tab === "similar" ? "active" : ""}" data-action="detail-tab" data-tab="similar" role="tab" aria-selected="${active.tab === "similar"}">More like this</button></div><div id="detail-tab-panel" class="detail-tab-panel" role="tabpanel">${detailPanel()}</div>`}</div>`;
  detailDialog.setAttribute("aria-labelledby", "detail-title");
}
function detailPanel() {
  if (active.tab === "similar") {
    const items = normalizeResults(
      active.m.recommendations?.results || [],
      active.m.media_type,
    ).slice(0, 12);
    return items.length
      ? `<div class="card-row">${items.map((m) => card(m, store)).join("")}</div>`
      : '<p class="settings-note">Recommendations will appear when the live catalog is connected.</p>';
  }
  const seasons = (active.m.seasons || []).filter((s) => s.episode_count > 0);
  return `<div class="season-heading"><h3>Find your next episode</h3>${seasons.length ? `<select id="season-select" aria-label="Choose a season">${seasons.map((s) => `<option value="${s.season_number}" ${s.season_number === active.season ? "selected" : ""}>${esc(s.name)} · ${s.episode_count} episodes</option>`).join("")}</select>` : ""}</div><div id="episode-list" class="episode-list">${active.episodes.length ? episodeMarkup() : active.loaded ? '<p class="settings-note">Loading episodes…</p>' : '<p class="settings-note">Connect the live catalog for episode descriptions. You can choose a season and episode manually in the player.</p>'}</div>`;
}
function episodeMarkup() {
  return active.episodes
    .map(
      (ep) =>
        `<button class="episode-item ${ep.episode_number === active.episode ? "active" : ""}" data-action="episode" data-episode="${ep.episode_number}"><span class="episode-number">${String(ep.episode_number).padStart(2, "0")}</span>${ep.still_path ? `<img src="${imageUrl(ep.still_path, "w300")}" alt="" loading="lazy">` : ""}<span class="episode-copy"><h4>${esc(ep.name || `Episode ${ep.episode_number}`)}</h4><p>${esc(ep.overview || "No description available.")}</p></span><span class="episode-runtime">${ep.runtime ? `${ep.runtime} min` : ""}</span>${icon("play")}</button>`,
    )
    .join("");
}
async function loadSeason(number, version = detailVersion) {
  if (!active) return;
  seasonController?.abort();
  seasonController = new AbortController();
  const requestId = ++seasonVersion;
  const seasons = (active.m.seasons || []).filter((s) => s.episode_count > 0);
  if (seasons.length && !seasons.some((s) => s.season_number === number))
    number = seasons[0].season_number;
  active.season = number;
  active.episodes = [];
  if ($("#episode-list"))
    $("#episode-list").innerHTML =
      '<p class="settings-note">Loading episodes…</p>';
  const play = $('[data-action="start-stream"]');
  if (play) play.disabled = true;
  try {
    const data = await season(active.m.id, number, seasonController.signal);
    if (version !== detailVersion || requestId !== seasonVersion || !active)
      return;
    active.episodes = data.episodes || [];
    if (!active.episodes.some((e) => e.episode_number === active.episode))
      active.episode = active.episodes[0]?.episode_number || 1;
    if (active.tab === "episodes" && $("#detail-tab-panel"))
      $("#detail-tab-panel").innerHTML = detailPanel();
    if (!active.episodes.length && $("#episode-list"))
      $("#episode-list").innerHTML =
        '<p class="settings-note">No episodes are listed for this season yet.</p>';
  } catch (error) {
    if (
      version !== detailVersion ||
      requestId !== seasonVersion ||
      error.name === "AbortError"
    )
      return;
    if ($("#episode-list"))
      $("#episode-list").innerHTML =
        '<p class="settings-note">Episodes could not be loaded. Choose another season or retry the title. Manual episode selection is available in the player.</p>';
  } finally {
    if (version === detailVersion && requestId === seasonVersion && active) {
      const button = $('[data-action="start-stream"]');
      if (button) {
        button.disabled = false;
        button.innerHTML =
          icon("play") + ` Play S${active.season} E${active.episode}`;
      }
    }
  }
}
function closeDetails() {
  detailController?.abort();
  seasonController?.abort();
  ++detailVersion;
  ++seasonVersion;
  detailDialog.close();
  active = null;
  if (returnFocus?.isConnected) returnFocus.focus();
}
function frameHTML(url, name) {
  const restricted = currentSettings().playerSandbox;
  return `<iframe src="${esc(url)}" title="${esc(name)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" ${restricted ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"' : ""}></iframe>`;
}
async function startStream() {
  if (!active) return;
  playerMedia = { ...active.m, season: active.season, episode: active.episode };
  playerMode = "stream";
  store.remember(playerMedia);
  renderStream();
  if (!watchDialog.open) watchDialog.showModal();
}
function renderStream(serverId = currentSettings().defaultServer) {
  const m = playerMedia;
  if (!m) return;
  const provider = PROVIDERS.find((p) => p.id === serverId) || PROVIDERS[0];
  watchDialog.innerHTML = `<div class="watch-header"><div class="watch-heading"><h2>${esc(title(m))}</h2><p>${m.media_type === "tv" ? `Season ${m.season} · Episode ${m.episode} · ` : ""}${provider.name}</p></div><div class="watch-controls"><button class="icon-button" data-action="fullscreen" aria-label="Fullscreen player">${icon("expand")}</button><button class="icon-button" data-action="close-watch" aria-label="Close player">${icon("close")}</button></div></div><div class="watch-stage"><div class="stage-loading"><span class="loading-orbit"></span></div>${frameHTML(providerUrl(provider, m, m.season, m.episode), `${title(m)} — ${provider.name}`)}</div><div class="watch-toolbar"><label class="sr-label" for="server-select">Server</label><select id="server-select" aria-label="Streaming server">${PROVIDERS.map((p) => `<option value="${p.id}" ${provider.id === p.id ? "selected" : ""}>${p.name}</option>`).join("")}</select><button class="button subtle" data-action="reload-stream">Reload</button><button class="button subtle" data-action="toggle-sandbox">${icon("settings")} Restrictions ${currentSettings().playerSandbox ? "on" : "off"}</button><span class="spacer"></span>${m.media_type === "tv" ? `<div class="watch-episode-nav"><button class="button subtle" data-action="previous-episode" ${m.episode <= 1 ? "disabled" : ""}>${icon("back")} Previous</button><label>Season <input type="number" id="player-season" min="0" max="200" value="${m.season}" aria-label="Season number" style="width:50px;background:#222d1b;color:inherit;border:1px solid #3c4931;border-radius:5px;padding:5px"></label><label>Episode <input type="number" id="player-episode" min="1" max="2000" value="${m.episode}" aria-label="Episode number" style="width:55px;background:#222d1b;color:inherit;border:1px solid #3c4931;border-radius:5px;padding:5px"></label><button class="button subtle" data-action="go-episode">Go</button><button class="button subtle" data-action="next-episode">Next ${icon("arrow")}</button></div>` : ""}</div><p class="watch-note">Quality, audio, subtitles and seeking are controlled inside the provider’s player. If playback fails, switch servers or adjust restrictions. Episode selections are saved; embedded playback timestamps are not available.</p>`;
  const frame = $(".watch-stage iframe");
  frame.addEventListener("load", () => $(".stage-loading")?.remove(), {
    once: true,
  });
}
async function changeEpisode(delta) {
  if (!playerMedia || playerMedia.media_type !== "tv") return;
  let next = playerMedia.episode + delta,
    number = playerMedia.season;
  const known = (playerMedia.seasons || []).find(
    (s) => s.season_number === number,
  );
  if (known && next > known.episode_count) {
    const nextSeason = (playerMedia.seasons || []).find(
      (s) => s.season_number === number + 1 && s.episode_count > 0,
    );
    if (!nextSeason) {
      toast("You’ve reached the last listed episode.");
      return;
    }
    number++;
    next = 1;
  }
  if (next < 1) return;
  playEpisode(number, next);
}
function playEpisode(number, episode) {
  if (
    !Number.isInteger(number) ||
    number < 0 ||
    number > 200 ||
    !Number.isInteger(episode) ||
    episode < 1 ||
    episode > 2000
  ) {
    toast("Enter a valid season and episode.", "error");
    return;
  }
  playerMedia = { ...playerMedia, season: number, episode };
  store.remember(playerMedia);
  if (active && mediaKey(active.m) === mediaKey(playerMedia)) {
    active.season = number;
    active.episode = episode;
  }
  renderStream($("#server-select")?.value);
}
async function showTrailer() {
  const m = active?.m;
  if (!m) return;
  const videos = m.videos?.results || [];
  const trailer =
    videos.find(
      (v) => v.site === "YouTube" && v.type === "Trailer" && v.official,
    ) || videos.find((v) => v.site === "YouTube" && v.type === "Trailer");
  if (!trailer || !/^[-\w]{11}$/.test(trailer.key)) {
    toast("No trailer is available for this title right now.");
    return;
  }
  playerMode = "trailer";
  watchDialog.innerHTML = `<div class="watch-header"><div class="watch-heading"><h2>${esc(title(m))} · Official trailer</h2></div><button class="icon-button" data-action="close-watch" aria-label="Close trailer">${icon("close")}</button></div><div class="watch-stage"><iframe src="https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1" title="${esc(title(m))} trailer" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  watchDialog.showModal();
}
async function closeWatch() {
  clearTimeout(sleepTimer);
  sleepTimer = null;
  const video = $("#local-video");
  if (video) {
    saveLocalPosition();
    video.pause();
  }
  if (document.pictureInPictureElement)
    await document.exitPictureInPicture().catch(() => {});
  watchDialog.close();
  watchDialog.innerHTML = "";
  if (localURL) {
    URL.revokeObjectURL(localURL);
    localURL = null;
  }
  if (subtitleURL) {
    URL.revokeObjectURL(subtitleURL);
    subtitleURL = null;
  }
  if (active && detailDialog.open) {
    renderDetails();
    if (active.m.media_type === "tv" && active.loaded)
      loadSeason(active.season);
  }
}

function localPositions() {
  try {
    const positions = JSON.parse(
      localStorage.getItem("cinelocal_local_positions") || "{}",
    );
    return positions && typeof positions === "object" && !Array.isArray(positions)
      ? positions
      : {};
  } catch {
    return {};
  }
}
function saveLocalPosition() {
  const video = $("#local-video");
  if (
    !video ||
    !localResumeKey ||
    !Number.isFinite(video.duration) ||
    video.currentTime < 1
  )
    return;
  try {
    const positions = localPositions();
    positions[localResumeKey] = {
      time: video.ended ? 0 : video.currentTime,
      at: Date.now(),
    };
    const entries = Object.entries(positions)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 50);
    localStorage.setItem(
      "cinelocal_local_positions",
      JSON.stringify(Object.fromEntries(entries)),
    );
  } catch {}
}
async function openLocal(file) {
  if (!file) return;
  if (
    !file.type.startsWith("video/") &&
    !/\.(mp4|mkv|webm|mov|m4v|ogv|avi)$/i.test(file.name)
  ) {
    toast("Choose a video file supported by your browser.", "error");
    return;
  }
  if (watchDialog.open) await closeWatch();
  localFile = file;
  localResumeKey = `${file.name}:${file.size}:${file.lastModified}`;
  localURL = URL.createObjectURL(file);
  playerMode = "local";
  watchDialog.innerHTML = `<div class="watch-header"><div class="watch-heading"><h2>${esc(file.name)}</h2><p>LOCAL PLAYER · Only on your device</p></div><div class="watch-controls"><button class="icon-button" data-action="pip" aria-label="Picture in picture">${icon("pip")}</button><button class="icon-button" data-action="fullscreen" aria-label="Fullscreen player">${icon("expand")}</button><button class="icon-button" data-action="close-watch" aria-label="Close player">${icon("close")}</button></div></div><div class="watch-stage"><video id="local-video" controls playsinline preload="metadata" src="${localURL}"></video></div><div class="watch-toolbar"><button class="button subtle" data-action="seek-back">−10 seconds</button><button class="button subtle" data-action="seek-forward">+10 seconds</button><label>Speed <select id="playback-speed" aria-label="Playback speed">${[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((n) => `<option value="${n}" ${n === 1 ? "selected" : ""}>${n}×</option>`).join("")}</select></label><button class="button subtle" data-action="subtitles">${icon("upload")} Subtitles</button><button class="button subtle hidden" data-action="toggle-captions">Captions on</button><span class="spacer"></span><label>Sleep <select id="sleep-timer" aria-label="Sleep timer"><option value="0">Off</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">60 min</option><option value="90">90 min</option></select></label></div><p class="watch-note" id="local-note">Space: play/pause · ← →: seek · M: mute · F: fullscreen. Your video is never uploaded.</p>`;
  watchDialog.showModal();
  const video = $("#local-video");
  video.volume = currentSettings().volume;
  let lastSave = 0;
  video.addEventListener("loadedmetadata", () => {
    const last = localPositions()[localResumeKey]?.time;
    if (last > 0 && last < video.duration - 10) {
      video.currentTime = last;
      toast(`Resuming at ${timeLabel(last)}`);
    }
    video.play().catch(() => {});
  });
  video.addEventListener("timeupdate", () => {
    if (Date.now() - lastSave > 5000) {
      saveLocalPosition();
      lastSave = Date.now();
    }
  });
  video.addEventListener("pause", saveLocalPosition);
  video.addEventListener("ended", saveLocalPosition);
  video.addEventListener("volumechange", () => {
    try {
      store.settings({ volume: video.volume });
    } catch {}
  });
  video.addEventListener("error", () => {
    $("#local-note").textContent =
      "This video format or codec is not supported by your browser. Try an MP4 with H.264 video and AAC audio.";
    toast("This browser could not decode the video.", "error");
  });
  if (!document.pictureInPictureEnabled)
    $('[data-action="pip"]').disabled = true;
}
async function loadSubtitles(file) {
  const video = $("#local-video");
  if (!file || !video) return;
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Please choose a subtitle file smaller than 5 MB.");
  let contents = (await file.text()).replace(/^\uFEFF/, "");
  if (/\.srt$/i.test(file.name))
    contents =
      "WEBVTT\n\n" + contents.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  if (!contents.trimStart().startsWith("WEBVTT"))
    throw new Error("Choose a valid SRT or WebVTT subtitle file.");
  video.querySelectorAll("track").forEach((el) => el.remove());
  if (subtitleURL) URL.revokeObjectURL(subtitleURL);
  subtitleURL = URL.createObjectURL(new Blob([contents], { type: "text/vtt" }));
  const track = document.createElement("track");
  track.kind = "subtitles";
  track.label = file.name;
  track.srclang = "en";
  track.src = subtitleURL;
  track.default = true;
  video.append(track);
  track.addEventListener("load", () => (track.track.mode = "showing"));
  track.track.mode = "showing";
  const btn = $('[data-action="toggle-captions"]');
  btn.classList.remove("hidden");
  btn.textContent = "Captions on";
  toast("Subtitles added.");
}
const actions = {
  "skip-content": () => main.focus(),
  navigate: (el) => navigate(el.dataset.route),
  menu: () => {
    const open = $("#sidebar").classList.toggle("mobile-open");
    $(".mobile-menu").setAttribute("aria-expanded", String(open));
  },
  genre: (el) => navigate("discover", { genre: el.dataset.genre }),
  hero: (el) => {
    heroIndex = Number(el.dataset.index);
    $(".hero").outerHTML = heroMarkup();
  },
  details: (el) => openDetails(el.dataset.key),
  play: (el) => openDetails(el.dataset.key, true),
  save: (el) => {
    const m = media.get(el.dataset.key);
    if (!m) return;
    const added = store.toggle("watchlist", m);
    toast(
      added ? "A good story, saved for later." : "Removed from your watchlist.",
    );
  },
  watched: (el) => {
    const m = media.get(el.dataset.key);
    if (m)
      toast(
        store.toggle("watched", m)
          ? "Added to your completed collection."
          : "Removed from completed titles.",
      );
  },
  remove: (el) => {
    store.remove(el.dataset.list, el.dataset.key);
    toast("Removed from your collection.");
  },
  scroll: (el) => {
    document
      .getElementById(el.dataset.target)
      ?.scrollBy({
        left:
          Number(el.dataset.direction) *
          document.getElementById(el.dataset.target).clientWidth *
          0.8,
        behavior: currentSettings().reducedMotion ? "instant" : "smooth",
      });
  },
  surprise: () => {
    const pool = visible(homeData?.sections.movies || previewCatalog).filter(
      (m) => !store.has("watched", m),
    );
    if (!pool.length) {
      toast("Try showing completed titles to find more picks.");
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    media.set(mediaKey(pick), pick);
    return openDetails(mediaKey(pick));
  },
  retry: () => {
    homeData = null;
    return renderRoute();
  },
  "reset-filters": () => navigate(route === "search" ? "discover" : route),
  "load-more": async (el) => {
    if (loadingMore) return;
    el.disabled = true;
    el.textContent = "Finding more stories…";
    page++;
    await loadCatalog(routeVersion, true);
    if (el.isConnected) {
      el.disabled = false;
      el.textContent = "Explore more titles";
    }
  },
  "library-filter": (el) =>
    navigate(route, {
      ...Object.fromEntries(routeParams),
      type: el.dataset.type,
    }),
  "clear-search": () => {
    clearTimeout(searchTimer);
    $("#search-input").value = "";
    $(".search-clear").classList.add("hidden");
    navigate("home");
    $("#search-input").focus();
  },
  "close-details": closeDetails,
  "retry-details": () => openDetails(mediaKey(active.m)),
  "detail-tab": (el) => {
    active.tab = el.dataset.tab;
    renderDetails();
  },
  episode: (el) => {
    active.episode = Number(el.dataset.episode);
    return startStream();
  },
  "start-stream": startStream,
  trailer: showTrailer,
  rate: (el) => {
    if (active) {
      store.rate(active.m, Number(el.dataset.rating));
      renderDetails();
    }
  },
  "copy-link": async (el) => {
    const link = new URL(location.href);
    link.hash = `home?title=${el.dataset.key}`;
    await navigator.clipboard.writeText(link.href);
    toast("Title link copied.");
  },
  "close-watch": closeWatch,
  "reload-stream": () => renderStream($("#server-select").value),
  "toggle-sandbox": () => {
    store.settings({ playerSandbox: !currentSettings().playerSandbox });
    renderStream($("#server-select").value);
    toast(
      `Player restrictions ${currentSettings().playerSandbox ? "enabled" : "disabled"}.`,
    );
  },
  "previous-episode": () => changeEpisode(-1),
  "next-episode": () => changeEpisode(1),
  "go-episode": () =>
    playEpisode(
      Number($("#player-season").value),
      Number($("#player-episode").value),
    ),
  fullscreen: async () => {
    const stage = $(".watch-stage");
    if (!stage) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (stage.requestFullscreen) await stage.requestFullscreen();
    else {
      const v = $("#local-video");
      if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
      else toast("Use the fullscreen control inside the player.");
    }
  },
  pip: async () => {
    const v = $("#local-video");
    if (!v) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (v.requestPictureInPicture) await v.requestPictureInPicture();
  },
  "choose-video": () => $("#video-input").click(),
  subtitles: () => $("#subtitle-input").click(),
  "seek-back": () => {
    const v = $("#local-video");
    if (v) v.currentTime = Math.max(0, v.currentTime - 10);
  },
  "seek-forward": () => {
    const v = $("#local-video");
    if (v && Number.isFinite(v.duration))
      v.currentTime = Math.min(v.duration, v.currentTime + 10);
  },
  "toggle-captions": (el) => {
    const track = $("#local-video")?.textTracks[0];
    if (track) {
      track.mode = track.mode === "showing" ? "hidden" : "showing";
      el.textContent = `Captions ${track.mode === "showing" ? "on" : "off"}`;
    }
  },
  shortcuts: () => {
    if (!$("#shortcuts-dialog").open) $("#shortcuts-dialog").showModal();
  },
  "close-shortcuts": () => $("#shortcuts-dialog").close(),
  export: () => {
    downloadJSON(store.get());
    toast("Your library backup is ready.");
  },
  import: () => $("#backup-input").click(),
  "clear-history": () => {
    if (
      confirm(
        "Clear recently watched titles? Your watchlist and completed titles will be kept.",
      )
    ) {
      store.clearHistory();
      renderSettings();
      toast("Viewing history cleared.");
    }
  },
  connection: async (el) => {
    el.disabled = true;
    el.textContent = "Connecting…";
    try {
      await request("/movie/popular");
      toast("Live catalog connected.");
      homeData = null;
    } finally {
      el.disabled = false;
      el.textContent = "Check catalog connection";
    }
  },
};
document.addEventListener(
  "click",
  guard(async (e) => {
    const el = e.target.closest("[data-action]");
    if (el && !el.disabled) {
      e.preventDefault();
      await actions[el.dataset.action]?.(el);
    } else if (
      $("#sidebar").classList.contains("mobile-open") &&
      !e.target.closest("#sidebar")
    ) {
      $("#sidebar").classList.remove("mobile-open");
      $(".mobile-menu").setAttribute("aria-expanded", "false");
    }
  }),
);
document.addEventListener(
  "change",
  guard(async (e) => {
    const el = e.target;
    if (el.dataset.filter) {
      const params = Object.fromEntries(routeParams);
      params[el.dataset.filter] = el.value;
      if (el.dataset.filter === "type") delete params.genre;
      navigate(route, params);
    }
    if (el.hasAttribute("data-library-sort"))
      navigate(route, { ...Object.fromEntries(routeParams), sort: el.value });
    if (el.dataset.setting) {
      store.settings({
        [el.dataset.setting]: el.type === "checkbox" ? el.checked : el.value,
      });
      toast("Preference saved.");
    }
    if (el.id === "season-select") {
      active.episode = 1;
      await loadSeason(Number(el.value));
    }
    if (el.id === "server-select") renderStream(el.value);
    if (el.id === "playback-speed" && $("#local-video"))
      $("#local-video").playbackRate = Number(el.value);
    if (el.id === "sleep-timer") {
      clearTimeout(sleepTimer);
      sleepTimer = null;
      if (Number(el.value) > 0) {
        sleepTimer = setTimeout(
          () => {
            $("#local-video")?.pause();
            if ($("#sleep-timer")) $("#sleep-timer").value = "0";
            toast("Sleep timer paused your video.");
          },
          Number(el.value) * 60000,
        );
        toast(`Video will pause in ${el.value} minutes.`);
      }
    }
    if (el.id === "video-input") {
      const file = el.files[0];
      el.value = "";
      await openLocal(file);
    }
    if (el.id === "subtitle-input") {
      const file = el.files[0];
      el.value = "";
      await loadSubtitles(file);
    }
    if (el.id === "backup-input") {
      const file = el.files[0];
      el.value = "";
      if (!file) return;
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 10 MB.");
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("This file is not a valid JSON backup.");
      }
      if (
        confirm(
          "Replace your current library and preferences with this backup? Export your current library first if you want to keep it.",
        )
      ) {
        store.import(data);
        if (route === "settings") renderSettings();
        toast("Your library is home. Backup restored.");
      }
    }
  }),
);
document.addEventListener("input", (e) => {
  if (e.target.id !== "search-input") return;
  const q = e.target.value.trim();
  $(".search-clear").classList.toggle("hidden", !q);
  clearTimeout(searchTimer);
  if (route === "search") {
    routeController?.abort();
    ++routeVersion;
  }
  searchTimer = setTimeout(() => {
    if (q.length >= 2) navigate("search", { q });
    else if (q && route === "search") navigate("search", { q });
    else if (!q && route === "search") navigate("home");
  }, 350);
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "search-form") {
    e.preventDefault();
    clearTimeout(searchTimer);
    navigate("search", { q: $("#search-input").value.trim() });
  }
});
document.addEventListener(
  "keydown",
  guard(async (e) => {
    if (e.key === "Escape" && $("#sidebar").classList.contains("mobile-open")) {
      $("#sidebar").classList.remove("mobile-open");
      $(".mobile-menu").setAttribute("aria-expanded", "false");
    }
    if (e.target.closest('input,textarea,select,[contenteditable="true"]'))
      return;
    if (
      e.key === "/" &&
      !detailDialog.open &&
      !watchDialog.open &&
      !$("#shortcuts-dialog").open
    ) {
      e.preventDefault();
      $("#search-input").focus();
    }
    if (e.key === "?" && !watchDialog.open) {
      e.preventDefault();
      actions.shortcuts();
    }
    if (watchDialog.open && playerMode === "local") {
      const v = $("#local-video");
      if (!v) return;
      // Native video controls handle their own keyboard events.
      if (e.target === v) return;
      if (e.code === "Space" && e.target.tagName !== "BUTTON") {
        e.preventDefault();
        if (v.paused) await v.play();
        else v.pause();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 10);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (Number.isFinite(v.duration))
          v.currentTime = Math.min(v.duration, v.currentTime + 10);
      }
      if (e.key.toLowerCase() === "m") v.muted = !v.muted;
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        await actions.fullscreen();
      }
    }
  }),
);
for (const dialog of [detailDialog, watchDialog]) {
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    guard(dialog === watchDialog ? closeWatch : closeDetails)();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        guard(dialog === watchDialog ? closeWatch : closeDetails)();
    }
  });
}
document.addEventListener(
  "error",
  (e) => {
    if (e.target.tagName === "IMG") {
      const fallback = e.target.dataset.fallback;
      if (fallback) {
        delete e.target.dataset.fallback;
        e.target.src = fallback;
      } else e.target.hidden = true;
    }
  },
  true,
);
document.addEventListener("dragover", (e) => {
  if (e.target.closest("#local-drop")) {
    e.preventDefault();
    $("#local-drop").classList.add("dragging");
  }
});
document.addEventListener("dragleave", (e) => {
  if (e.target.closest("#local-drop"))
    $("#local-drop").classList.remove("dragging");
});
document.addEventListener(
  "drop",
  guard(async (e) => {
    if (e.target.closest("#local-drop")) {
      e.preventDefault();
      $("#local-drop").classList.remove("dragging");
      await openLocal(e.dataTransfer.files[0]);
    }
  }),
);
window.addEventListener("storage", (e) => {
  if (e.key === "cinelocal_v2") store.refresh();
});
window.addEventListener("pagehide", saveLocalPosition);
async function routeAndDeepLink() {
  const expectedHash = location.hash;
  await renderRoute();
  if (location.hash !== expectedHash) return;
  const deep = routeParams.get("title");
  if (deep && /^(movie|tv):\d+$/.test(deep)) {
    if (!media.has(deep)) {
      const [type, id] = deep.split(":");
      media.set(deep, {
        id: Number(id),
        media_type: type,
        title: "Loading title…",
      });
    }
    await openDetails(deep);
  }
}
window.addEventListener(
  "hashchange",
  guard(() => {
    window.scrollTo({ top: 0 });
    return routeAndDeepLink();
  }),
);
renderShell();
indexMedia([
  ...store.get().watchlist,
  ...store.get().history,
  ...store.get().watched,
]);
if (store.getIssue()) toast(store.getIssue(), "error");
guard(routeAndDeepLink)();
