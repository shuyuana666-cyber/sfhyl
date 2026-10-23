const siteOrigin = String(import.meta.env.VITE_SITE_URL || "").replace(
  /\/$/,
  ""
);
const apiOrigin = (() => {
  try {
    return new URL(String(import.meta.env.VITE_API_BASE_URL || "")).origin;
  } catch {
    return "";
  }
})();

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("//")) return `${window.location.protocol}${url}`;

  const origin = url.startsWith("/uploads/") ? apiOrigin : siteOrigin;
  if (!origin) return url;
  return new URL(url.replace(/^\/+/, ""), `${origin}/`).href;
}
