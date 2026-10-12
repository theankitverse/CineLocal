import { icon } from "./icons.js";
import { IMG, GENRES } from "./config.js";
import { mediaKey } from "./store.js";
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const imageUrl = (path, size = "w500") =>
  typeof path === "string" && /^\/[\w.-]+$/.test(path)
    ? `${IMG}/${size}${path}`
    : "";
export const title = (m) => m.title || m.name || "Untitled";
export const year = (m) =>
  (m.release_date || m.first_air_date || "").slice(0, 4);
export const rating = (m) =>
  Number(m.vote_average) > 0 ? Number(m.vote_average).toFixed(1) : "NR";
export const typeLabel = (m) => (m.media_type === "tv" ? "Series" : "Movie");
export function card(
  m,
  store,
  { rank = 0, landscape = false, removeFrom = "" } = {},
) {
  const key = mediaKey(m),
    saved = store.has("watchlist", m),
    watched = store.has("watched", m);
  const path = imageUrl(
    landscape ? m.backdrop_path || m.poster_path : m.poster_path,
    landscape ? "w780" : "w342",
  );
  return `<article class="media-card ${landscape ? "landscape-card" : ""} ${rank ? "ranked-card" : ""}" data-key="${key}">
 <div class="card-art"><button class="card-open" data-action="details" data-key="${key}" aria-label="View ${escape(title(m))}">${path ? `<img src="${path}" alt="" loading="lazy" decoding="async">` : ""}<span class="poster-fallback">${icon("film")}<span>${escape(title(m))}</span></span><span class="card-shade"></span><span class="card-play">${icon("play")}</span>${rank ? `<span class="rank-number">${rank.toString().padStart(2, "0")}</span>` : ""}${watched ? `<span class="watched-badge">${icon("check")} Watched</span>` : ""}</button>
 <button class="card-save ${saved ? "is-saved" : ""}" data-action="save" data-key="${key}" aria-label="${saved ? "Remove from" : "Add to"} watchlist: ${escape(title(m))}" aria-pressed="${saved}">${icon(saved ? "check" : "plus")}</button>${removeFrom ? `<button class="card-remove" data-action="remove" data-list="${removeFrom}" data-key="${key}" aria-label="Remove ${escape(title(m))} from ${removeFrom}">${icon("close")}</button>` : ""}
 ${landscape && m.media_type === "tv" ? `<span class="episode-marker">S${m.season || 1} · E${m.episode || 1}</span>` : ""}</div>
 <div class="card-info"><button data-action="details" data-key="${key}" class="card-title">${escape(title(m))}</button><div class="card-meta"><span>${year(m) || typeLabel(m)} <i>·</i> ${typeLabel(m)}</span><span class="card-rating">${icon("star")}${rating(m)}</span></div></div></article>`;
}
export function row(heading, kicker, items, store, options = {}) {
  const id = options.id || heading.toLowerCase().replace(/\W+/g, "-");
  return `<section class="shelf" aria-labelledby="${id}-heading"><div class="section-heading"><div><p class="eyebrow">${escape(kicker)}</p><h2 id="${id}-heading">${escape(heading)}${options.count ? ` <span class="heading-count">${options.count}</span>` : ""}</h2></div><div class="shelf-actions">${options.more ? `<button class="text-button" data-action="navigate" data-route="${options.more}">View all ${icon("arrow")}</button>` : ""}<button class="icon-button shelf-arrow previous" data-action="scroll" data-target="${id}" data-direction="-1" aria-label="Scroll ${escape(heading)} left">${icon("chevron")}</button><button class="icon-button shelf-arrow" data-action="scroll" data-target="${id}" data-direction="1" aria-label="Scroll ${escape(heading)} right">${icon("chevron")}</button></div></div><div id="${id}" class="card-row ${options.landscape ? "landscape-row" : ""}">${items.map((m, i) => card(m, store, { ...options, rank: options.ranked ? i + 1 : 0 })).join("")}</div></section>`;
}
export function empty(
  titleText,
  description,
  button = "Explore the catalog",
  route = "discover",
  symbol = "bookmark",
) {
  return `<div class="empty-state"><div class="empty-icon">${icon(symbol)}</div><h2>${escape(titleText)}</h2><p>${escape(description)}</p>${button ? `<button class="button primary" data-action="navigate" data-route="${route}">${escape(button)} ${icon("arrow")}</button>` : ""}</div>`;
}
export function skeleton(count = 6) {
  return `<div class="card-grid">${Array.from({ length: count }, () => '<div class="skeleton"><div></div><span></span><span></span></div>').join("")}</div>`;
}
export function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === "error" ? "info" : "check")}<span>${escape(message)}</span>`;
  document.querySelector("#toasts").append(el);
  setTimeout(() => el.remove(), 4500);
}
export function genreNames(m) {
  return (
    m.genres?.map((g) => g.name) ||
    m.genre_ids?.map((id) => GENRES[id]).filter(Boolean) ||
    []
  )
    .slice(0, 3)
    .join(" · ");
}
export function downloadJSON(data) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `cinelocal-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const timeLabel = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h ? h + ":" : ""}${h ? String(m).padStart(2, "0") : m}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
};
