export const IMG = "https://image.tmdb.org/t/p";
export const PROVIDERS = [
  {
    id: "vidlink",
    name: "VidLink",
    movie: "https://vidlink.pro/movie/{id}",
    tv: "https://vidlink.pro/tv/{id}/{season}/{episode}",
  },
  {
    id: "rivestream",
    name: "RiveStream",
    movie: "https://rivestream.ru/embed?type=movie&id={id}",
    tv: "https://rivestream.ru/embed?type=tv&id={id}&season={season}&episode={episode}",
  },
  {
    id: "vidsrc",
    name: "VidSrc",
    movie: "https://vidsrc.to/embed/movie/{id}",
    tv: "https://vidsrc.to/embed/tv/{id}/{season}/{episode}",
    idType: "imdb",
  },
  {
    id: "vidsrcme",
    name: "VidSrc.me",
    movie: "https://vidsrc.me/embed/movie/{id}",
    tv: "https://vidsrc.me/embed/tv/{id}/{season}-{episode}",
    idType: "imdb",
  },
  {
    id: "2embed",
    name: "2Embed",
    movie: "https://www.2embed.cc/embed/{id}",
    tv: "https://www.2embed.cc/embedtv/{id}&s={season}&e={episode}",
  },
  {
    id: "smashy",
    name: "SmashyStream",
    movie: "https://embed.smashystream.com/playere.php?tmdb={id}",
    tv: "https://embed.smashystream.com/playere.php?tmdb={id}&season={season}&episode={episode}",
  },
];
export const GENRES = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10765: "Sci-Fi & Fantasy",
  10764: "Reality",
  10768: "War & Politics",
};
export function providerUrl(provider, media, season = 1, episode = 1) {
  const id =
    provider.idType === "imdb"
      ? media.imdb_id || media.external_ids?.imdb_id || media.id
      : media.id;
  return provider[media.media_type === "tv" ? "tv" : "movie"]
    .replace("{id}", encodeURIComponent(id))
    .replace("{season}", String(season))
    .replace("{episode}", String(episode));
}
