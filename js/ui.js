/**
 * CineLocal — UI Rendering Module
 * Handles all DOM creation, manipulation, and visual state changes.
 */

const UI = (() => {
  const { TMDB_IMG_BASE, PLAYER_MIRRORS, PLAYER_MIRRORS_TV } = CONFIG;

  // ─── Player State ─────────────────────────────────────
  let _currentTmdbId = null;
  let _currentImdbId = null;
  let _currentMovieTitle = "";
  let _currentMovieData = null;
  let _currentMediaType = "movie";
  let _currentSeason = 1;
  let _currentEpisode = 1;
  let _currentMalId = null;
  let _activeServerIndex = 0;
  let _sandboxEnabled = false;

  // ─── DOM References ─────────────────────────────────────
  const els = {
    hero: document.getElementById("hero"),
    heroBackdrop: document.getElementById("hero-backdrop"),
    heroTitle: document.getElementById("hero-title"),
    heroOverview: document.getElementById("hero-overview"),
    heroMeta: document.getElementById("hero-meta"),
    heroBadge: document.getElementById("hero-badge"),
    heroPlayBtn: document.getElementById("hero-play-btn"),
    popularRow: document.getElementById("popular-row"),
    trendingRow: document.getElementById("trending-row"),
    topRatedRow: document.getElementById("top-rated-row"),
    popularTvSection: document.getElementById("popular-tv-section"),
    popularTvRow: document.getElementById("popular-tv-row"),
    trendingTvSection: document.getElementById("trending-tv-section"),
    trendingTvRow: document.getElementById("trending-tv-row"),
    searchResultsSection: document.getElementById("search-results-section"),
    searchResultsGrid: document.getElementById("search-results-grid"),
    searchResultsCount: document.getElementById("search-results-count"),
    loadMore: document.getElementById("load-more"),
    loadMoreBtn: document.getElementById("load-more-btn"),
    playerOverlay: document.getElementById("player-overlay"),
    playerTitle: document.getElementById("player-title"),
    playerServers: document.getElementById("player-servers"),
    playerClose: document.getElementById("player-close"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    modalPoster: document.getElementById("modal-poster"),
    modalRating: document.getElementById("modal-rating"),
    modalYear: document.getElementById("modal-year"),
    modalOverview: document.getElementById("modal-overview"),
    modalDetailsView: document.getElementById("modal-details-view"),
    modalPlayerView: document.getElementById("modal-player-view"),
    modalPlayBtn: document.getElementById("modal-play-btn"),
    modalWatchlistBtn: document.getElementById("modal-watchlist-btn"),
    modalTvControls: document.getElementById("modal-tv-controls"),
    seasonSelect: document.getElementById("season-select"),
    episodeGrid: document.getElementById("episode-grid"),
    historySection: document.getElementById("history-section"),
    historyRow: document.getElementById("history-row"),
    watchlistSection: document.getElementById("watchlist-section"),
    watchlistRow: document.getElementById("watchlist-row"),
    playerSwitchWrapper: document.getElementById("player-switch-wrapper"),
    playerSwitchBtn: document.getElementById("player-switch-btn"),
    playerServerDropdown: document.getElementById("player-server-dropdown"),
    playerSandboxBtn: document.getElementById("player-sandbox-btn"),
    playerMovieName: document.getElementById("player-movie-name"),
    playerBackBtn: document.getElementById("player-back-btn"),
    playerPlayerClose: document.getElementById("player-player-close"),
    playerIframe: document.getElementById("player-iframe"),
    toastContainer: document.getElementById("toast-container"),
    searchInput: document.getElementById("search-input"),
    searchClear: document.getElementById("search-clear"),
    navbar: document.getElementById("navbar"),
  };

  // ─── Immersive Player: Auto-Hide Header on Top-Edge Hover ───
  let _headerHideTimer = null;
  els.modalPlayerView.addEventListener("mousemove", (e) => {
    const rect = els.modalPlayerView.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const header = els.modalPlayerView.querySelector(".player-modal__player-header");
    if (!header) return;

    if (relY <= 80) {
      header.classList.add("player-header--visible");
      clearTimeout(_headerHideTimer);
    } else {
      // Small delay before hiding so quick mouse movements don't flicker
      clearTimeout(_headerHideTimer);
      _headerHideTimer = setTimeout(() => {
        header.classList.remove("player-header--visible");
      }, 400);
    }
  });
  els.modalPlayerView.addEventListener("mouseleave", () => {
    const header = els.modalPlayerView.querySelector(".player-modal__player-header");
    if (header) {
      clearTimeout(_headerHideTimer);
      _headerHideTimer = setTimeout(() => {
        header.classList.remove("player-header--visible");
      }, 300);
    }
  });

  // ─── Hero Banner ────────────────────────────────────────
  function renderHero(movie) {
    if (!movie) return;

    const backdropUrl = movie.backdrop_path
      ? `${TMDB_IMG_BASE}/original${movie.backdrop_path}`
      : "";

    if (backdropUrl) {
      els.heroBackdrop.style.backgroundImage = `url(${backdropUrl})`;
    }

    const title = movie.title || movie.name || movie.original_title || movie.original_name || "Untitled";
    const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
    els.heroTitle.textContent = title;
    els.heroOverview.textContent = movie.overview || "";

    const year = (movie.release_date || movie.first_air_date || "").split("-")[0] || "N/A";
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
    const votes = movie.vote_count
      ? movie.vote_count.toLocaleString()
      : "0";

    els.heroMeta.innerHTML = `
      <span class="hero__meta-item hero__meta-item--rating">⭐ ${rating}</span>
      <span class="hero__meta-item">📅 ${year}</span>
      <span class="hero__meta-item">👥 ${votes} votes</span>
    `;

    els.heroPlayBtn.setAttribute("data-tmdb-id", movie.id);
    els.heroPlayBtn.setAttribute("data-title", title);
    els.heroPlayBtn.setAttribute("data-media-type", mediaType);
  }

  // ─── Movie Card ─────────────────────────────────────────
  function createMovieCard(movie) {
    const card = document.createElement("div");
    card.className = "movie-card";
    const mediaType = movie.media_type || (movie.first_air_date ? "tv" : "movie");
    card.setAttribute("data-tmdb-id", movie.id);
    card.setAttribute("data-media-type", mediaType);

    const posterUrl = movie.poster_path
      ? `${TMDB_IMG_BASE}/w500${movie.poster_path}`
      : "";

    const year = (movie.release_date || movie.first_air_date || "").split("-")[0];
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "—";
    const title = movie.title || movie.name || movie.original_title || movie.original_name || "Untitled";

    card.innerHTML = `
      <div class="movie-card__poster">
        ${
          posterUrl
            ? `<img class="movie-card__img" src="${posterUrl}" alt="${_escapeHtml(title)}" loading="lazy" />`
            : `<div class="movie-card__no-poster">🎬</div>`
        }
        <div class="movie-card__overlay">
          <span class="movie-card__overlay-title">${_escapeHtml(title)}</span>
          <span class="movie-card__overlay-meta">
            <span>⭐ ${rating}</span>
            ${year ? `<span>• ${year}</span>` : ""}
          </span>
        </div>
        <button class="movie-card__play-btn" data-tmdb-id="${movie.id}" data-title="${_escapeHtml(title)}" data-media-type="${mediaType}" aria-label="Play ${_escapeHtml(title)}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <span class="movie-card__rating">⭐ ${rating}</span>
      </div>
      <div class="movie-card__info">
        <span class="movie-card__title">${_escapeHtml(title)}</span>
        <span class="movie-card__year">${year}</span>
      </div>
    `;

    return card;
  }

  // ─── Render Cards into Container ────────────────────────
  function renderMovies(movies, container, append = false) {
    if (!append) {
      container.innerHTML = "";
    }

    const fragment = document.createDocumentFragment();
    movies.forEach((movie) => {
      fragment.appendChild(createMovieCard(movie));
    });
    container.appendChild(fragment);
  }

  // ─── Skeleton Loading ──────────────────────────────────
  function showSkeletons(container, count = 10) {
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement("div");
      skeleton.className = "skeleton-card";
      skeleton.innerHTML = `
        <div class="skeleton-card__poster"></div>
        <div class="skeleton-card__info">
          <div class="skeleton-card__line"></div>
          <div class="skeleton-card__line skeleton-card__line--short"></div>
        </div>
      `;
      fragment.appendChild(skeleton);
    }

    container.appendChild(fragment);
  }

  // ─── Search Results ─────────────────────────────────────
  function showSearchResults(movies, totalResults, append = false) {
    els.searchResultsSection.classList.remove("hidden");
    els.searchResultsCount.textContent = `${totalResults.toLocaleString()} results`;
    renderMovies(movies, els.searchResultsGrid, append);
  }

  function hideSearchResults() {
    els.searchResultsSection.classList.add("hidden");
    els.searchResultsGrid.innerHTML = "";
    els.searchResultsCount.textContent = "";
  }

  function showLoadMore() {
    els.loadMore.classList.remove("hidden");
  }

  function hideLoadMore() {
    els.loadMore.classList.add("hidden");
  }

  // ─── Video Player (Native Top-Level Playback) ──────────
  // ─── Video Player (Netflix-Style Inline Ad-Blocked Playback) ───
  async function _checkServerReachable(url) {
    try {
      const domain = new URL(url).origin;
      // High-performance primary mirrors protected by Cloudflare are assumed online to avoid CDN/CORS blocks
      if (domain.includes("vidlink.pro") || domain.includes("vidsrc.to") || domain.includes("vidsrc.me")) {
        return true;
      }
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1800); // 1.8 seconds timeout
      await fetch(domain, { mode: 'no-cors', signal: controller.signal });
      clearTimeout(id);
      return true;
    } catch (e) {
      return false;
    }
  }

  function _loadInlineFrame(serverIndex) {
    if (!_currentTmdbId) return;
    _activeServerIndex = serverIndex;
    
    const mirrors = _currentMediaType === "tv" ? PLAYER_MIRRORS_TV : PLAYER_MIRRORS;
    const server = mirrors[serverIndex];
    
    // Choose correct ID (IMDb, TMDB, or MAL) based on server spec
    let targetId;
    if (server.idType === "mal") {
      targetId = _currentMalId || _currentTmdbId;
    } else {
      targetId = (server.idType === "imdb" && _currentImdbId) ? _currentImdbId : _currentTmdbId;
    }
    
    let url = server.url.replace("{id}", targetId);
    if (_currentMediaType === "tv" || server.idType === "mal") {
      url = url.replace("{season}", _currentSeason).replace("{episode}", _currentEpisode);
    }
    
    // Update sandbox permissions
    _updateSandboxUI();

    // Recreate the iframe element to force the browser to apply the updated sandbox rules.
    // Dynamically adding/removing the sandbox attribute on an already instantiated iframe
    // does not lift restrictions in all browser rendering engines.
    const oldIframe = els.playerIframe;
    const newIframe = document.createElement("iframe");
    newIframe.id = "player-iframe";
    newIframe.className = oldIframe.className;
    newIframe.width = "100%";
    newIframe.height = "100%";
    newIframe.style.cssText = oldIframe.style.cssText;
    newIframe.allowFullscreen = true;
    newIframe.setAttribute("scrolling", "no");
    newIframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen");
    
    if (_sandboxEnabled) {
      newIframe.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin allow-presentation allow-downloads allow-pointer-lock allow-top-navigation");
    }
    
    newIframe.src = url;
    
    if (oldIframe && oldIframe.parentNode) {
      oldIframe.parentNode.replaceChild(newIframe, oldIframe);
    }
    els.playerIframe = newIframe;

    els.playerMovieName.textContent = _currentMovieTitle + (_currentMediaType === "tv" ? ` - S${_currentSeason}:E${_currentEpisode}` : "");
    els.playerSwitchBtn.textContent = `🔄 Switch Server (${server.label})`;
    els.playerSwitchBtn.classList.remove("hidden");
  }

  async function openPlayer(tmdbId, title, mediaType) {
    _currentTmdbId = tmdbId;
    _currentImdbId = null;
    _currentMediaType = mediaType || "movie";
    _currentMovieTitle = title || (_currentMediaType === "tv" ? "TV Show" : "Movie");
    _currentMovieData = null;

    // Set basic states immediately
    els.modalDetailsView.classList.remove("hidden");
    els.modalPlayerView.classList.add("hidden");
    els.playerIframe.src = "";

    els.playerTitle.textContent = _currentMovieTitle;
    els.modalOverview.textContent = _currentMediaType === "tv" ? "Loading show description..." : "Loading movie description...";
    els.modalRating.textContent = "⭐ --";
    els.modalYear.textContent = "📅 --";
    els.modalPoster.src = "";
    els.modalBackdrop.style.backgroundImage = "none";

    // Update watchlist button to loading
    els.modalWatchlistBtn.textContent = "➕ My Watchlist";
    els.modalWatchlistBtn.classList.remove("btn--watchlist-active");

    _currentMalId = null;

    // Show modal overlay
    els.playerOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    try {
      let details;
      if (_currentMediaType === "tv") {
        details = await API.fetchTVDetails(tmdbId);
        _currentImdbId = details.external_ids ? details.external_ids.imdb_id : null;
        _currentMovieTitle = details.name || details.original_name || title || "TV Show";
      } else {
        details = await API.fetchMovieDetails(tmdbId);
        _currentImdbId = details.imdb_id;
        _currentMovieTitle = details.title || details.original_title || title || "Movie";
      }

      // Query Anime MAL ID in the background using the verified title
      _fetchAnimeMalId(_currentMovieTitle);

      _currentMovieData = details;
      els.playerTitle.textContent = _currentMovieTitle;
      els.modalOverview.textContent = details.overview || "No description available.";
      
      const rating = details.vote_average ? details.vote_average.toFixed(1) : "N/A";
      els.modalRating.textContent = `⭐ ${rating}`;
      
      const year = (details.release_date || details.first_air_date || "").split("-")[0] || "N/A";
      els.modalYear.textContent = `📅 ${year}`;

      if (details.poster_path) {
        els.modalPoster.src = `${TMDB_IMG_BASE}/w500${details.poster_path}`;
      }
      if (details.backdrop_path) {
        els.modalBackdrop.style.backgroundImage = `url(${TMDB_IMG_BASE}/original${details.backdrop_path})`;
      }
      
      if (_currentMediaType === "tv") {
        // Populate season selector
        els.seasonSelect.innerHTML = "";
        if (details.seasons && details.seasons.length > 0) {
          // Filter out specials unless there are only specials
          const validSeasons = details.seasons.filter(s => s.season_number > 0 && s.episode_count > 0);
          const seasonsToUse = validSeasons.length > 0 ? validSeasons : details.seasons;
          
          seasonsToUse.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.season_number;
            opt.textContent = s.name || `Season ${s.season_number}`;
            els.seasonSelect.appendChild(opt);
          });
          
          // Default to first available season
          _currentSeason = seasonsToUse[0].season_number;
        } else {
          _currentSeason = 1;
          const opt = document.createElement("option");
          opt.value = 1;
          opt.textContent = "Season 1";
          els.seasonSelect.appendChild(opt);
        }
        
        _currentEpisode = 1;
        
        // Remove old change listener and add new one
        els.seasonSelect.onchange = (e) => {
          _currentSeason = Number(e.target.value);
          _currentEpisode = 1;
          // Update modal play button text
          els.modalPlayBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
            Play S${_currentSeason}:E${_currentEpisode}
          `;
          _loadTVSeason(tmdbId, _currentSeason);
        };
        
        // Set play button text
        els.modalPlayBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
          Play S${_currentSeason}:E${_currentEpisode}
        `;
        
        // Load episodes for the default season
        _loadTVSeason(tmdbId, _currentSeason);
        els.modalTvControls.classList.remove("hidden");
      } else {
        els.modalTvControls.classList.add("hidden");
        els.modalPlayBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
          Play Movie
        `;
      }

      // Update watchlist button status
      updateWatchlistButton();
    } catch (error) {
      console.error("Failed to load details inside modal:", error);
      _currentMovieData = {
        id: Number(tmdbId),
        title: _currentMovieTitle,
        name: _currentMovieTitle,
        media_type: _currentMediaType,
        vote_average: 0.0,
        release_date: "",
        first_air_date: ""
      };
      els.playerTitle.textContent = _currentMovieTitle;
      els.modalOverview.textContent = "Could not fetch additional description. Playback remains active below.";
      els.modalTvControls.classList.add("hidden");
      els.modalPlayBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
        Play Movie
      `;
      
      updateWatchlistButton();
    }
  }

  async function _loadTVSeason(tvId, seasonNumber) {
    els.episodeGrid.innerHTML = '<div class="episode-loading">Loading episodes...</div>';
    try {
      const data = await API.fetchTVSeasonDetails(tvId, seasonNumber);
      els.episodeGrid.innerHTML = "";
      if (data.episodes && data.episodes.length > 0) {
        // Find and highlight/set active button text for the current episode
        const activeEp = data.episodes.find(e => Number(e.episode_number) === Number(_currentEpisode)) || data.episodes[0];
        _currentEpisode = activeEp.episode_number;
        els.modalPlayBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
          Play S${seasonNumber}:E${_currentEpisode} - ${_escapeHtml(activeEp.name)}
        `;

        data.episodes.forEach((ep) => {
          const epCard = document.createElement("div");
          epCard.className = "episode-card";
          if (Number(ep.episode_number) === Number(_currentEpisode)) {
            epCard.classList.add("episode-card--active");
          }
          
          const stillUrl = ep.still_path 
            ? `${TMDB_IMG_BASE}/w300${ep.still_path}` 
            : "";
            
          epCard.innerHTML = `
            <div class="episode-card__image-wrapper">
              ${stillUrl 
                ? `<img src="${stillUrl}" class="episode-card__img" alt="${_escapeHtml(ep.name)}" loading="lazy" />` 
                : `<div class="episode-card__no-img">🎬</div>`
              }
              <div class="episode-card__number">${ep.episode_number}</div>
            </div>
            <div class="episode-card__info">
              <div class="episode-card__title-row">
                <span class="episode-card__title">${_escapeHtml(ep.name)}</span>
                ${ep.runtime ? `<span class="episode-card__runtime">${ep.runtime} min</span>` : ""}
              </div>
              <p class="episode-card__overview">${ep.overview || "No description available."}</p>
            </div>
          `;
          
          epCard.addEventListener("click", () => {
            _currentEpisode = ep.episode_number;
            _currentSeason = seasonNumber;
            // update active state in UI
            document.querySelectorAll(".episode-card").forEach(card => card.classList.remove("episode-card--active"));
            epCard.classList.add("episode-card--active");
            // Update modal play button text
            els.modalPlayBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
              Play S${_currentSeason}:E${_currentEpisode} - ${_escapeHtml(ep.name)}
            `;
            // Trigger playback
            startInlinePlayback();
          });
          
          els.episodeGrid.appendChild(epCard);
        });
      } else {
        els.episodeGrid.innerHTML = '<div class="episode-empty">No episodes found for this season.</div>';
      }
    } catch (error) {
      console.error("Failed to load season details:", error);
      els.episodeGrid.innerHTML = '<div class="episode-error">Failed to load episodes. Check your connection.</div>';
    }
  }

  async function startInlinePlayback() {
    if (!_currentTmdbId) return;

    const mirrors = _currentMediaType === "tv" ? PLAYER_MIRRORS_TV : PLAYER_MIRRORS;

    // Add to history (Continue Watching)
    if (_currentMovieData) {
      let history = JSON.parse(localStorage.getItem("cinelocal_history") || "[]");
      
      // Remove duplicates
      history = history.filter((m) => m.id !== Number(_currentTmdbId));
      
      // Add current to front
      history.unshift({
        id: Number(_currentTmdbId),
        title: _currentMovieData.title || _currentMovieData.name || _currentMovieTitle,
        name: _currentMovieData.name || _currentMovieData.title || _currentMovieTitle,
        poster_path: _currentMovieData.poster_path,
        vote_average: _currentMovieData.vote_average,
        release_date: _currentMovieData.release_date || "",
        first_air_date: _currentMovieData.first_air_date || "",
        media_type: _currentMediaType
      });
      
      // Cap at 10 items
      history = history.slice(0, 10);
      
      localStorage.setItem("cinelocal_history", JSON.stringify(history));
      
      // Notify App to refresh its rows
      if (window.App && typeof window.App.refreshRows === "function") {
        window.App.refreshRows();
      }
    }

    // Show loading player state
    els.modalDetailsView.classList.add("hidden");
    els.modalPlayerView.classList.remove("hidden");

    els.playerMovieName.textContent = "Checking connections to mirrors...";
    els.playerSwitchBtn.classList.add("hidden");
    showToast(`Loading stream on ${mirrors[0].label}...`, "info");
    _loadInlineFrame(0);
  }

  function _renderServerDropdownItems() {
    els.playerServerDropdown.innerHTML = "";
    const mirrors = _currentMediaType === "tv" ? PLAYER_MIRRORS_TV : PLAYER_MIRRORS;
    const fragment = document.createDocumentFragment();

    mirrors.forEach((mirror, idx) => {
      // Exclude Anime Server if not an anime
      if (mirror.idType === "mal" && !_currentMalId) return;
      
      const btn = document.createElement("button");
      btn.className = "player-modal__dropdown-item";
      if (idx === _activeServerIndex) {
        btn.classList.add("player-modal__dropdown-item--active");
      }
      btn.textContent = mirror.label;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        _loadInlineFrame(idx);
        toggleServerDropdown(false);
      });
      fragment.appendChild(btn);
    });

    els.playerServerDropdown.appendChild(fragment);
  }

  function toggleServerDropdown(forceState) {
    const isHidden = els.playerServerDropdown.classList.contains("hidden");
    const nextState = forceState !== undefined ? !forceState : !isHidden;

    if (nextState) {
      els.playerServerDropdown.classList.add("hidden");
    } else {
      _renderServerDropdownItems();
      els.playerServerDropdown.classList.remove("hidden");
    }
  }

  function goBackToDetails() {
    els.playerIframe.src = "";
    toggleServerDropdown(false);
    els.modalPlayerView.classList.add("hidden");
    els.modalDetailsView.classList.remove("hidden");
  }

  function closePlayer() {
    els.playerOverlay.classList.add("hidden");
    els.modalDetailsView.classList.remove("hidden");
    els.modalPlayerView.classList.add("hidden");
    toggleServerDropdown(false);
    
    // Reset sandbox settings
    _sandboxEnabled = false;
    _updateSandboxUI();

    els.playerIframe.src = "";
    _currentTmdbId = null;
    _currentImdbId = null;
    _currentMovieTitle = "";
    _currentMovieData = null;
    _currentMediaType = "movie";
    _currentSeason = 1;
    _currentEpisode = 1;
    _activeServerIndex = 0;
    els.modalPoster.src = "";
    els.modalBackdrop.style.backgroundImage = "none";
    document.body.style.overflow = "";
  }

  function updateWatchlistButton() {
    if (!_currentTmdbId) return;
    const watchlist = JSON.parse(localStorage.getItem("cinelocal_watchlist") || "[]");
    const isInWatchlist = watchlist.some((m) => m.id === Number(_currentTmdbId));
    
    if (isInWatchlist) {
      els.modalWatchlistBtn.textContent = "✓ In Watchlist";
      els.modalWatchlistBtn.classList.add("btn--watchlist-active");
    } else {
      els.modalWatchlistBtn.textContent = "➕ My Watchlist";
      els.modalWatchlistBtn.classList.remove("btn--watchlist-active");
    }
  }

  function toggleWatchlist() {
    if (!_currentTmdbId || !_currentMovieData) return;
    
    let watchlist = JSON.parse(localStorage.getItem("cinelocal_watchlist") || "[]");
    const idx = watchlist.findIndex((m) => m.id === Number(_currentTmdbId));
    
    if (idx > -1) {
      watchlist.splice(idx, 1);
      showToast("Removed from Watchlist", "info");
    } else {
      watchlist.push({
        id: Number(_currentTmdbId),
        title: _currentMovieData.title || _currentMovieData.original_title || _currentMovieTitle,
        poster_path: _currentMovieData.poster_path,
        vote_average: _currentMovieData.vote_average,
        release_date: _currentMovieData.release_date
      });
      showToast("Added to Watchlist", "success");
    }
    
    localStorage.setItem("cinelocal_watchlist", JSON.stringify(watchlist));
    updateWatchlistButton();
    
    // Refresh App rows
    if (window.App && typeof window.App.refreshRows === "function") {
      window.App.refreshRows();
    }
  }

  function _updateSandboxUI() {
    if (!els.playerSandboxBtn) return;
    if (_sandboxEnabled) {
      els.playerSandboxBtn.textContent = "🔒 Ad-Block: ON";
      els.playerSandboxBtn.classList.remove("player-modal__sandbox-btn--off");
    } else {
      els.playerSandboxBtn.textContent = "🔓 Ad-Block: OFF (No Ads Blocked)";
      els.playerSandboxBtn.classList.add("player-modal__sandbox-btn--off");
    }
  }

  function toggleSandbox() {
    _sandboxEnabled = !_sandboxEnabled;
    _updateSandboxUI();
    // Reload player with the updated sandbox rules
    if (_currentTmdbId) {
      showToast(`Reloading stream with Ad-Block ${_sandboxEnabled ? "ON" : "OFF"}...`, "info");
      _loadInlineFrame(_activeServerIndex);
    }
  }

  // ─── Toast Notifications ───────────────────────────────
  function showToast(message, type = "error") {
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;

    const icon = type === "error" ? "⚠️" : "ℹ️";
    toast.innerHTML = `
      <span class="toast__icon">${icon}</span>
      <span class="toast__message">${_escapeHtml(message)}</span>
    `;

    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateX(40px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ─── Search Input State ─────────────────────────────────
  function showSearchClear() {
    els.searchClear.classList.remove("hidden");
  }

  function hideSearchClear() {
    els.searchClear.classList.add("hidden");
  }

  function clearSearchInput() {
    els.searchInput.value = "";
    hideSearchClear();
  }

  // ─── Navbar Scroll Effect ──────────────────────────────
  function updateNavbarScroll() {
    if (window.scrollY > 50) {
      els.navbar.classList.add("scrolled");
    } else {
      els.navbar.classList.remove("scrolled");
    }
  }

  // ─── Helpers ────────────────────────────────────────────
  function _escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  async function _fetchAnimeMalId(queryTitle) {
    if (!queryTitle) return;
    try {
      // Clean query title (e.g. remove year indicators like (2020) from Jikan queries)
      const cleanTitle = queryTitle.replace(/\s*\(\d{4}\)\s*/g, "").trim();
      
      // Fetch only 1 result to keep Jikan queries fast and lightweight
      const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          _currentMalId = data.data[0].mal_id;
          console.log(`Matched Anime MAL ID for "${queryTitle}": ${_currentMalId}`);
        }
      }
    } catch (error) {
      console.error("Jikan API search failed:", error);
    }
  }

  // ─── Public API ─────────────────────────────────────────
  return {
    els,
    renderHero,
    renderMovies,
    showSkeletons,
    showSearchResults,
    hideSearchResults,
    showLoadMore,
    hideLoadMore,
    openPlayer,
    closePlayer,
    startInlinePlayback,
    toggleServerDropdown,
    toggleSandbox,
    toggleWatchlist,
    goBackToDetails,
    showToast,
    showSearchClear,
    hideSearchClear,
    clearSearchInput,
    updateNavbarScroll,
  };
})();
