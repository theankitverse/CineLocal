const cache = new Map();
export async function request(path, params = {}, { signal } = {}) {
  const query = new URLSearchParams({ path, language: "en-US" });
  for (const [key, value] of Object.entries(params))
    if (value !== "" && value != null) query.set(key, String(value));
  const url = `/api/tmdb?${query}`;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < 300000)
    return structuredClone(cached.data);
  const timeout = AbortSignal.timeout(14000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The catalog could not be loaded.");
  cache.set(url, { data, at: Date.now() });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return structuredClone(data);
}
export const details = (type, id, signal) =>
  request(
    `/${type}/${id}`,
    { append_to_response: "videos,credits,recommendations,external_ids" },
    { signal },
  );
export const season = (id, number, signal) =>
  request(`/tv/${id}/season/${number}`, {}, { signal });
