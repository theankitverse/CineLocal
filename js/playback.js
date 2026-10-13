export function directVideoUrl(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error("Enter a complete HTTPS video URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error(
      "Use an HTTPS video link without login credentials in the URL.",
    );
  if (!/\.(mp4|webm|m4v|ogv)$/i.test(url.pathname))
    throw new Error(
      "Use a direct MP4 or WebM file link, not a streaming website page.",
    );
  return url.href;
}
