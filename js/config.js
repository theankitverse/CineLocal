/**
 * CineLocal — Configuration
 * 
 * ⚠️  Replace the placeholder below with your TMDB API key.
 *     Get a free key at: https://www.themoviedb.org/settings/api
 * 
 * This file is git-ignored to keep your key out of version control.
 */

const CONFIG = Object.freeze({
  TMDB_API_KEY: "e321785d70e75652c4e94fca91e3b276",
  TMDB_BASE_URL: "https://api.themoviedb.org/3",
  TMDB_IMG_BASE: "https://image.tmdb.org/t/p",
  PLAYER_MIRRORS: [
    { label: "Server 1 (VidLink)", url: "https://vidlink.pro/movie/{id}", idType: "tmdb" },
    { label: "Server 2 (RiveStream)", url: "https://rivestream.ru/embed?type=movie&id={id}", idType: "tmdb" },
    { label: "Server 3 (VidSrc Fast)", url: "https://vidsrc.to/embed/movie/{id}", idType: "imdb" },
    { label: "Server 4 (VidSrc.me)", url: "https://vidsrc.me/embed/movie/{id}", idType: "imdb" },
    { label: "Server 5 (2Embed)", url: "https://www.2embed.cc/embed/{id}", idType: "tmdb" },
    { label: "Server 6 (SmashyStream)", url: "https://embed.smashystream.com/playere.php?tmdb={id}", idType: "tmdb" },
  ],
  PLAYER_MIRRORS_TV: [
    { label: "Server 1 (VidLink)", url: "https://vidlink.pro/tv/{id}/{season}/{episode}", idType: "tmdb" },
    { label: "Server 2 (RiveStream)", url: "https://rivestream.ru/embed?type=tv&id={id}&season={season}&episode={episode}", idType: "tmdb" },
    { label: "Server 3 (VidSrc Fast)", url: "https://vidsrc.to/embed/tv/{id}/{season}/{episode}", idType: "imdb" },
    { label: "Server 4 (VidSrc.me)", url: "https://vidsrc.me/embed/tv/{id}/{season}-{episode}", idType: "imdb" },
    { label: "Server 5 (2Embed)", url: "https://www.2embed.cc/embedtv/{id}&s={season}&e={episode}", idType: "tmdb" },
    { label: "Server 6 (SmashyStream)", url: "https://embed.smashystream.com/playere.php?tmdb={id}&season={season}&episode={episode}", idType: "tmdb" },
  ],
});
