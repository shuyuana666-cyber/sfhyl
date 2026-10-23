const siteOrigin = String(import.meta.env.VITE_SITE_URL || "").replace(
  /\/$/,
  ""
);
const apiOrigin = (() => {
  try {
    return new URL(String(import.meta.env.VITE_API_BASE_URL || "")).origin;
  } catch {
    return window.location.origin;
  }
})();
const mediaPath = String(import.meta.env.VITE_MEDIA_BASE_PATH || '/media').replace(/\/$/, '');
const legacyBucket = String(import.meta.env.VITE_LEGACY_MEDIA_BUCKET || 'sfhyl');
const legacyPort = String(import.meta.env.VITE_LEGACY_MEDIA_PORT || '9200');

function rewriteLegacyMediaUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const bucketPath = `/${legacyBucket}/`;
    if (/^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname) && parsed.port === legacyPort && parsed.pathname.startsWith(bucketPath)) {
      return `${mediaPath}/${parsed.pathname.slice(bucketPath.length)}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Relative paths already use the configured site or API origin below.
  }
  return value;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  const normalized = rewriteLegacyMediaUrl(url);
  if (/^(?:https?:|data:|blob:)/i.test(normalized)) return normalized;
  if (normalized.startsWith("//")) return `${window.location.protocol}${normalized}`;

  if (normalized.startsWith(`${mediaPath}/`)) return normalized;
  const origin = normalized.startsWith("/uploads/") ? apiOrigin : siteOrigin;
  if (!origin) return normalized;
  return new URL(normalized.replace(/^\/+/, ""), `${origin}/`).href;
}
