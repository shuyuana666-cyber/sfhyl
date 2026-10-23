const imageExtension = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i;
const loopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i;

// Check the same published media paths the website uses, including older MinIO
// records when the upload driver has subsequently changed to local storage.
export function localImagePaths(payloads, { bucket = 'sfhyl', minioPort = 9200 } = {}) {
  const paths = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value && typeof value === 'object') return Object.values(value).forEach(visit);
    if (typeof value !== 'string' || !imageExtension.test(value)) return;
    try {
      const url = new URL(value, 'http://127.0.0.1:5173');
      if (!loopbackHost.test(url.hostname)) return;
      if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/uploads/')) {
        paths.add(`${url.pathname}${url.search}`);
      } else if (url.port === String(minioPort) && url.pathname.startsWith(`/${bucket}/`)) {
        paths.add(`/media/${url.pathname.slice(bucket.length + 2)}${url.search}`);
      }
    } catch { /* Non-URL content is not a media dependency. */ }
  };
  payloads.forEach(visit);
  return [...paths];
}

export async function checkPublishedImages({
  apiBase = 'http://127.0.0.1:3002/api/v1/public',
  websiteBase = 'http://127.0.0.1:5173',
  bucket,
  minioPort,
  request = fetch,
} = {}) {
  const endpoints = ['site', 'home', 'homepage-content', 'vehicles', 'pages/about'];
  const payloads = [];
  const failures = [];
  await Promise.all(endpoints.map(async (endpoint) => {
    try {
      const response = await request(`${apiBase}/${endpoint}`, { signal: AbortSignal.timeout(5_000) });
      // An unpublished custom about page is valid; the frontend uses its defaults.
      if (endpoint === 'pages/about' && response.status === 404) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payloads.push(await response.json());
    } catch (error) {
      failures.push({ path: `/api/v1/public/${endpoint}`, error: error.message });
    }
  }));
  const paths = localImagePaths(payloads, { bucket, minioPort });
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, paths.length) }, async () => {
    while (next < paths.length) {
      const imagePath = paths[next++];
      try {
        const response = await request(`${websiteBase}${imagePath}`, {
          method: 'HEAD', signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) failures.push({ path: imagePath, error: `HTTP ${response.status}` });
      } catch (error) {
        failures.push({ path: imagePath, error: error.message });
      }
    }
  }));
  return { checked: paths.length, failures };
}
