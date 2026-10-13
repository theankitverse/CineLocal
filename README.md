# CineLocal 2.0

A personal cinema dashboard for movies, television and local video files. Built with native JavaScript modules, responsive CSS and one Vercel serverless function. No frontend framework, runtime packages or build dependencies.

## Run locally

Requires Node.js 22 or newer.

```sh
cp .env.example .env.local
# Set TMDB_API_KEY in .env.local to your TMDB v3 API key.
npm run dev
```

Open http://127.0.0.1:3000. The dev server serves the app and the same catalog proxy used in production. An existing local key was retained in the ignored `.env.local` during the upgrade. Never commit that file.

## Deploy to the existing cinelocalstream.vercel.app

**Use the existing Vercel project. Do not create a new project or change its domain.**

1. Open the Vercel project currently serving `cinelocalstream.vercel.app`.
2. Confirm its Git integration points to `theankitverse/CineLocal`, root directory is the repository root, and production branch is the branch you intend to deploy (currently `main` locally).
3. In **Settings → Environment Variables**, add `TMDB_API_KEY` with your TMDB **v3 API key** for Production and Preview. The value is available in your local `.env.local`; do not put it in source or browser settings.
4. The tracked `vercel.json` configures Framework Preset **Other**, Build Command **npm run build**, and Output Directory **dist**. Remove conflicting dashboard overrides if there are any. No custom install command is needed.
5. Commit and push this update to the connected production branch, or deploy a preview branch first and promote it. Redeploy after adding/changing the environment variable.
6. Verify `/api/tmdb?path=%2Fmovie%2Fpopular` returns catalog JSON, search works, and a saved TV show reopens with episode controls. The existing project keeps `https://cinelocalstream.vercel.app`.

Deployments are handled by the existing Vercel project’s Git integration. No `.vercel` project link is committed; verify the domain/project association and deployment status in your Vercel dashboard.

Vercel automatically deploys the root `api/tmdb.js` as a Node.js function alongside the static `dist` output. Hash-based navigation supports page refreshes without a catch-all rewrite that could intercept API routes.

If the key is missing or the upstream service is unavailable, the app identifies its built-in preview collection explicitly. Preview titles are not live rankings. Some sections can remain live while others fall back independently.

## Features

- Cinema dashboard with featured titles, trending movies/TV, popular shelves and top-rated movies.
- Multi-search, paginated discovery, format/genre/year/language/minimum-rating filters and sorting.
- Watchlist, recent titles, completed collection, five-star personal ratings and library sorting.
- Title details, cast, directors/creators, trailers and recommendations when provided by TMDB.
- Season/episode selection, manual episode entry, previous/next navigation and remembered selections.
- Eight embedded provider choices, including ScreenScape and VidFast; RiveStream is the default, with preferred-server settings, reload, fullscreen and configurable iframe restrictions.
- Local video player with native playback/seek/volume controls, speed, picture-in-picture where supported, fullscreen, SRT/WebVTT subtitles, sleep timer and saved position for reopened files.
- Profile name, compact browsing, hide-completed discovery, reduced motion and keyboard shortcuts.
- Versioned JSON library export/import with validation and confirmation before replacement.
- Short page exit/entry transitions, animated title panels, and press feedback with system/profile reduced-motion support.
- Direct HTTPS MP4/WebM playback in CineLocal’s native player, with no provider website loaded. Video links stay session-only.
- Purple cinema theme with a compact phone homepage, collapsible search, and smaller featured artwork.
- Phone-first layout with safe-area-aware bottom navigation, two-column browsing, swipeable shelves, full-screen title/player views, and larger touch controls. Desktop keeps its sidebar layout. Native modal focus handling and keyboard support.

## Audio and added providers

- [ScreenScape documentation](https://flix.screenscape.me/embed): movie/TV embeds with `lan=hindi` or `lan=eng`. The player offers a saved audio preference and a **Try Hindi audio** shortcut.
- [VidFast documentation](https://vidfast.vc/): alternative movie/TV sources with in-player server, audio and subtitle controls.

These are third-party sources, not guaranteed Hindi catalogs. Audio tracks depend on title, region and provider availability. The discovery **Original language** filter does not find dubbed copies. Switching servers restarts playback while preserving the selected season and episode. **Try next server** cycles through available providers.

## Playback boundaries

The **Player** page and embedded player settings offer **Play a video link** for direct HTTPS MP4/WebM files. These use native playback controls without loading provider scripts, so the player cannot open provider ad pages. Users must supply a video file URL from an authorized source; catalog entries do not automatically resolve to direct files. HLS playlists, website-page links, DRM content, expired links, and files unavailable to the browser are not supported by this option. Links are not persisted or exported.

CineLocal supplies catalog and library controls. Third-party players control their own stream quality, seeking, volume, subtitles and audio tracks. Provider availability and title availability are external dependencies. Unrestricted third-party embeds can open advertising pages. The parent app cannot cancel their cross-origin clicks or navigation; this release adds no ad blocker, script rewriting, or new iframe restrictions. Brave may apply browser protections that other browsers do not. The parent app cannot inspect a cross-origin player's playback time, so recent streaming history records title and episode selections, not a fabricated percentage or timestamp. There is no automatic stream health check or automatic next-episode playback for embeds.

The player has large **Fullscreen** and **Open server** actions below the video. Fullscreen uses a full-viewport fallback when native fullscreen is unavailable, with a persistent **Back to controls** button. Audio and restriction settings are grouped in an expandable panel; changing a preference keeps that panel open.

The local player has full HTML video controls. Codec support depends on the browser. Reopening the same filename/size/modified-date restores its last position. Files are never uploaded. Local playback positions stay on this browser and are not included in the catalog-library backup. Sleep timers can be delayed if the browser or device is suspended.

## Storage and privacy

Library and preferences use localStorage (`cinelocal_v2`). Existing `cinelocal_watchlist` and `cinelocal_history` lists are read during migration and left untouched. Film and TV identities use `media_type:id`, preventing collisions. Old records that already lost TV metadata cannot be reliably reconstructed; remove and re-add those titles if needed.

This is a personal-use interface, not an authenticated/private website. Deployment remains publicly reachable unless you configure access protection separately. There are no accounts or cross-device synchronization. Export/import is the portability mechanism.

The old API key was present in the repository's Git history. Moving it server-side prevents exposure in new browser assets; it does not remove old commits. If the repository was public, replace that key through TMDB and update Vercel/local environment settings.

## Security and reliability

- Server-only TMDB key; fixed upstream host, endpoint/parameter allowlists, bounded timeouts and retry.
- Cache successful catalog responses; independent homepage section fallbacks.
- Cancelled requests and request-version checks for search, detail and episode navigation.
- Escaped rendered strings and validated imported media paths.
- Embedded-player restrictions are off by default for provider compatibility. Existing profiles migrate to this default once; subsequent explicit choices persist. Turning restrictions on limits popups/top navigation and reloads the iframe.
- Vercel security headers include CSP, frame protection and restricted browser permissions.
- A public catalog proxy is not a quota guarantee. Configure Vercel rate limiting/access protection if public traffic warrants it.

## Checks

```sh
npm run check
npm test
npm run build
```

Tests cover TV identity, immediate storage notifications, migration/corruption, quota failures, episode persistence, imports, ratings, escaping, provider URLs and proxy restrictions.

## Layout

- `index.html`: application shell and native dialogs
- `css/styles.css`: design system and responsive layouts
- `js/app.js`: routes, discovery, details, playback and event wiring
- `js/api.js`: abortable cached catalog requests
- `js/store.js`: normalized, versioned local persistence
- `js/ui.js`, `js/icons.js`: safe rendering helpers and icons
- `js/config.js`: public provider and genre configuration, no credentials
- `js/demo.js`: labeled setup/offline preview collection
- `api/tmdb.js`: Vercel catalog proxy
- `scripts/`: dependency-free local server/build/check tooling
- `tests/`: Node test-runner regression coverage

Metadata and artwork are provided by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
