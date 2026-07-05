/**
 * CineLocal — TMDB API Module
 * Handles all asynchronous fetch requests to The Movie Database API.
 */

const API = (() => {
  const { TMDB_API_KEY, TMDB_BASE_URL } = CONFIG;

  /**
   * Generic fetch wrapper with error handling.
   * @param {string} endpoint - API path (e.g., "/movie/popular")
   * @param {Object} params  - Query parameters
   * @returns {Promise<Object>} Parsed JSON response
   */
  async function _fetch(endpoint, params = {}) {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set("api_key", TMDB_API_KEY);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        errorBody.status_message || `TMDB API error: ${response.status}`
      );
    }

    return response.json();
  }

  // ─── Movie Endpoints ───────────────────────────────────

  async function fetchPopularMovies(page = 1) {
    return _fetch("/movie/popular", { page, language: "en-US" });
  }

  async function fetchTrendingMovies(page = 1) {
    return _fetch("/trending/movie/week", { page, language: "en-US" });
  }

  async function fetchTopRatedMovies(page = 1) {
    return _fetch("/movie/top_rated", { page, language: "en-US" });
  }

  async function fetchMovieDetails(id) {
    return _fetch(`/movie/${id}`, { language: "en-US" });
  }

  // ─── TV Endpoints ─────────────────────────────────────

  async function fetchPopularTV(page = 1) {
    return _fetch("/tv/popular", { page, language: "en-US" });
  }

  async function fetchTrendingTV(page = 1) {
    return _fetch("/trending/tv/day", { page, language: "en-US" });
  }

  async function fetchTVDetails(id) {
    return _fetch(`/tv/${id}`, { language: "en-US", append_to_response: "external_ids" });
  }

  async function fetchTVSeasonDetails(id, seasonNumber) {
    return _fetch(`/tv/${id}/season/${seasonNumber}`, { language: "en-US" });
  }

  // ─── Multi-Search ──────────────────────────────────────

  /**
   * Search movies, TV shows, and people by query string.
   * @param {string} query - Search term
   * @param {number} page  - Page number
   * @returns {Promise<Object>}
   */
  async function searchMulti(query, page = 1) {
    return _fetch("/search/multi", { query, page, language: "en-US" });
  }

  // Public API
  return {
    fetchPopularMovies,
    fetchTrendingMovies,
    fetchTopRatedMovies,
    fetchMovieDetails,
    fetchPopularTV,
    fetchTrendingTV,
    fetchTVDetails,
    fetchTVSeasonDetails,
    searchMulti,
  };
})();
