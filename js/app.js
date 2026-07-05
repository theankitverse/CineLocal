/**
 * CineLocal — Main Application Controller
 * Wires together API calls, UI rendering, and user event handling.
 */

const App = (() => {
  // ─── State ──────────────────────────────────────────────
  const state = {
    searchQuery: "",
    searchPage: 1,
    searchTotalPages: 0,
    isSearching: false,
    debounceTimer: null,
  };

  const DEBOUNCE_MS = 400;

  // ─── Initialization ────────────────────────────────────
  async function init() {
    _bindEvents();
    _loadWatchlistAndHistoryRows();
    _loadAllSections();
  }

  // ─── Load Watchlist and History Local Storage Rows ──────
  function _loadWatchlistAndHistoryRows() {
    // 1. History
    const history = JSON.parse(localStorage.getItem("cinelocal_history") || "[]");
    if (history.length > 0) {
      UI.els.historySection.classList.remove("hidden");
      UI.renderMovies(history, UI.els.historyRow);
    } else {
      UI.els.historySection.classList.add("hidden");
      UI.els.historyRow.innerHTML = "";
    }

    // 2. Watchlist
    const watchlist = JSON.parse(localStorage.getItem("cinelocal_watchlist") || "[]");
    if (watchlist.length > 0) {
      UI.els.watchlistSection.classList.remove("hidden");
      UI.renderMovies(watchlist, UI.els.watchlistRow);
    } else {
      UI.els.watchlistSection.classList.add("hidden");
      UI.els.watchlistRow.innerHTML = "";
    }
  }

  // ─── Load All Sections ───────────────────────────
  async function _loadAllSections() {
    // Show skeletons for all rows
    UI.showSkeletons(UI.els.popularRow, 10);
    UI.showSkeletons(UI.els.trendingRow, 10);
    UI.showSkeletons(UI.els.topRatedRow, 10);
    UI.showSkeletons(UI.els.popularTvRow, 10);
    UI.showSkeletons(UI.els.trendingTvRow, 10);

    try {
      // Fetch all sections in parallel (movies + TV)
      const [popularData, trendingData, topRatedData, popularTvData, trendingTvData] = await Promise.all([
        API.fetchPopularMovies(1),
        API.fetchTrendingMovies(1),
        API.fetchTopRatedMovies(1),
        API.fetchPopularTV(1),
        API.fetchTrendingTV(1),
      ]);

      // Render Hero with first popular movie
      if (popularData.results && popularData.results.length > 0) {
        // Pick a random movie from top 5 for the hero
        const heroIdx = Math.floor(Math.random() * Math.min(5, popularData.results.length));
        UI.renderHero(popularData.results[heroIdx]);
      }

      // Render movie rows
      if (popularData.results) {
        UI.renderMovies(popularData.results, UI.els.popularRow);
      }

      if (trendingData.results) {
        UI.renderMovies(trendingData.results, UI.els.trendingRow);
      }

      if (topRatedData.results) {
        UI.renderMovies(topRatedData.results, UI.els.topRatedRow);
      }

      // Render TV rows (tag each result with media_type for card rendering)
      if (popularTvData.results) {
        const tvResults = popularTvData.results.map(item => ({ ...item, media_type: "tv" }));
        UI.renderMovies(tvResults, UI.els.popularTvRow);
      }

      if (trendingTvData.results) {
        const tvResults = trendingTvData.results.map(item => ({ ...item, media_type: item.media_type || "tv" }));
        UI.renderMovies(tvResults, UI.els.trendingTvRow);
      }
    } catch (error) {
      console.error("Failed to load sections:", error);
      UI.showToast(
        error.message.includes("API key")
          ? "Invalid TMDB API key. Please update js/config.js"
          : "Failed to load content. Check your connection.",
        "error"
      );
    }
  }

  // ─── Search ─────────────────────────────────────────────
  async function _performSearch(query, page = 1) {
    if (!query.trim()) {
      _clearSearch();
      return;
    }

    state.isSearching = true;
    state.searchQuery = query;
    state.searchPage = page;

    if (page === 1) {
      UI.showSkeletons(UI.els.searchResultsGrid, 12);
      UI.els.searchResultsSection.classList.remove("hidden");
    }

    try {
      const data = await API.searchMulti(query, page);
      state.searchTotalPages = data.total_pages;

      // Filter out 'person' results — only keep movies and TV shows
      const filtered = (data.results || []).filter(item => item.media_type !== "person");

      if (filtered.length > 0) {
        UI.showSearchResults(filtered, data.total_results, page > 1);

        // Show/hide Load More
        if (page < data.total_pages) {
          UI.showLoadMore();
        } else {
          UI.hideLoadMore();
        }
      } else if (page === 1) {
        UI.showSearchResults([], 0);
        UI.els.searchResultsGrid.innerHTML =
          '<p style="color: var(--text-muted); padding: 40px 0; text-align: center; grid-column: 1/-1;">No results found. Try a different search.</p>';
        UI.hideLoadMore();
      }
    } catch (error) {
      console.error("Search failed:", error);
      UI.showToast("Search failed. Please try again.", "error");
    }

    state.isSearching = false;
  }

  function _clearSearch() {
    state.searchQuery = "";
    state.searchPage = 1;
    state.searchTotalPages = 0;
    state.isSearching = false;

    UI.clearSearchInput();
    UI.hideSearchResults();
    UI.hideLoadMore();
  }

  // ─── Event Binding ─────────────────────────────────────
  function _bindEvents() {
    // Search input with debounce
    UI.els.searchInput.addEventListener("input", (e) => {
      const query = e.target.value;

      // Show/hide clear button
      if (query.length > 0) {
        UI.showSearchClear();
      } else {
        UI.hideSearchClear();
      }

      // Debounce
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => {
        if (query.trim().length >= 2) {
          _performSearch(query, 1);
        } else if (query.trim().length === 0) {
          _clearSearch();
        }
      }, DEBOUNCE_MS);
    });

    // Search clear button
    UI.els.searchClear.addEventListener("click", () => {
      _clearSearch();
      UI.els.searchInput.focus();
    });

    // Load More button
    UI.els.loadMoreBtn.addEventListener("click", () => {
      if (state.searchQuery && state.searchPage < state.searchTotalPages) {
        _performSearch(state.searchQuery, state.searchPage + 1);
      }
    });

    // Hero Play button
    UI.els.heroPlayBtn.addEventListener("click", () => {
      const tmdbId = UI.els.heroPlayBtn.getAttribute("data-tmdb-id");
      const title = UI.els.heroPlayBtn.getAttribute("data-title");
      const mediaType = UI.els.heroPlayBtn.getAttribute("data-media-type") || "movie";
      if (tmdbId) {
        UI.openPlayer(tmdbId, title, mediaType);
      }
    });

    // Movie card play buttons (event delegation on main content + hero)
    document.getElementById("content").addEventListener("click", _handleCardClick);

    // Player close button
    UI.els.playerClose.addEventListener("click", () => {
      UI.closePlayer();
    });

    // Modal Details View Play button
    UI.els.modalPlayBtn.addEventListener("click", () => {
      UI.startInlinePlayback();
    });

    // Modal Details View Watchlist button
    UI.els.modalWatchlistBtn.addEventListener("click", () => {
      UI.toggleWatchlist();
    });

    // Inline Switch Server button
    UI.els.playerSwitchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      UI.toggleServerDropdown();
    });

    // Inline Sandbox Toggle button
    UI.els.playerSandboxBtn.addEventListener("click", () => {
      UI.toggleSandbox();
    });

    // Inline Back to Details button
    UI.els.playerBackBtn.addEventListener("click", () => {
      UI.goBackToDetails();
    });

    // Inline Player Close button
    UI.els.playerPlayerClose.addEventListener("click", () => {
      UI.closePlayer();
    });

    // Close server dropdown if clicked outside the wrapper
    document.addEventListener("click", (e) => {
      if (UI.els.playerSwitchWrapper && !UI.els.playerSwitchWrapper.contains(e.target)) {
        UI.toggleServerDropdown(false);
      }
    });

    // Close player on overlay click (outside modal)
    UI.els.playerOverlay.addEventListener("click", (e) => {
      if (e.target === UI.els.playerOverlay) {
        UI.closePlayer();
      }
    });

    // Close player on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        UI.closePlayer();
      }
    });

    // Navbar scroll effect
    window.addEventListener("scroll", UI.updateNavbarScroll, { passive: true });

    // Home button — scroll to top & clear search
    document.getElementById("nav-home-btn").addEventListener("click", () => {
      _clearSearch();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Brand click — same as home
    document.getElementById("nav-brand").addEventListener("click", (e) => {
      e.preventDefault();
      _clearSearch();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ─── Card Click Handler (Event Delegation) ─────────────
  function _handleCardClick(e) {
    // Check if a play button was clicked
    const playBtn = e.target.closest(".movie-card__play-btn");
    if (playBtn) {
      e.stopPropagation();
      const tmdbId = playBtn.getAttribute("data-tmdb-id");
      const title = playBtn.getAttribute("data-title");
      const mediaType = playBtn.getAttribute("data-media-type") || "movie";
      if (tmdbId) {
        UI.openPlayer(tmdbId, title, mediaType);
      }
      return;
    }

    // Check if a card was clicked (anywhere on it)
    const card = e.target.closest(".movie-card");
    if (card) {
      const tmdbId = card.getAttribute("data-tmdb-id");
      const mediaType = card.getAttribute("data-media-type") || "movie";
      const titleEl = card.querySelector(".movie-card__title");
      const title = titleEl ? titleEl.textContent : (mediaType === "tv" ? "TV Show" : "Movie");
      if (tmdbId) {
        UI.openPlayer(tmdbId, title, mediaType);
      }
    }
  }

  // ─── Bootstrap ──────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", init);

  return {
    init,
    refreshRows: _loadWatchlistAndHistoryRows
  };
})();
