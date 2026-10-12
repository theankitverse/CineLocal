// Fixed-origin, read-only catalog proxy. The API key never reaches browser assets.
const allowedPaths = [
  /^\/(movie|tv)\/(popular|top_rated|now_playing|upcoming|on_the_air)$/,
  /^\/trending\/(movie|tv|all)\/(day|week)$/,
  /^\/discover\/(movie|tv)$/,
  /^\/search\/multi$/,
  /^\/genre\/(movie|tv)\/list$/,
  /^\/(movie|tv)\/\d+(\/(recommendations|similar|videos|credits|watch\/providers))?$/,
  /^\/tv\/\d+\/season\/\d+$/,
];
const params = new Set([
  "page",
  "query",
  "language",
  "sort_by",
  "with_genres",
  "primary_release_year",
  "first_air_date_year",
  "with_original_language",
  "vote_average.gte",
  "vote_count.gte",
  "append_to_response",
]);
export function buildUpstreamUrl(search, key) {
  const path = search.get("path") || "";
  if (!allowedPaths.some((rule) => rule.test(path)))
    throw new Error("Unsupported catalog request.");
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("include_adult", "false");
  for (const [name, value] of search) {
    if (params.has(name) && value.length <= 250)
      url.searchParams.set(name, value);
  }
  if (search.has("page"))
    url.searchParams.set(
      "page",
      String(Math.max(1, Math.min(500, Number(search.get("page")) || 1))),
    );
  return url;
}
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Only GET requests are supported." });
  }
  const key = process.env.TMDB_API_KEY;
  if (!key || key === "your_tmdb_api_key")
    return res
      .status(503)
      .json({
        error:
          "Add TMDB_API_KEY to your Vercel environment to connect the live catalog.",
        code: "SETUP_REQUIRED",
      });
  let url;
  try {
    url = buildUpstreamUrl(
      new URL(req.url, "http://localhost").searchParams,
      key,
    );
  } catch {
    return res.status(400).json({ error: "Unsupported catalog request." });
  }
  try {
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(url, {
          signal: AbortSignal.timeout(6000),
          headers: { Accept: "application/json" },
        });
        if (response.status >= 500 && attempt === 0) continue;
        break;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    if (!response.ok)
      return res
        .status(response.status === 401 ? 503 : response.status)
        .json({
          error:
            response.status === 401
              ? "The catalog API key needs updating in Vercel."
              : "The catalog is temporarily unavailable. Try again shortly.",
        });
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600",
    );
    return res.status(200).json(await response.json());
  } catch {
    return res
      .status(502)
      .json({
        error:
          "Unable to reach the catalog. You can still use your library and local player.",
      });
  }
}
