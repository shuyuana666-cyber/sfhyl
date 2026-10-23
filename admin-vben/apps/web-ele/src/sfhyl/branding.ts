import { updatePreferences } from '@vben/preferences';

import { resolveMediaUrl } from './legacy/utils/media';

type PublicSiteResponse = {
  data?: { settings?: { branding?: { logoUrl?: string } } };
  settings?: { branding?: { logoUrl?: string } };
};

export async function syncWebsiteLogo() {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  updatePreferences({ logo: { source: '/brand-logo.jpg', sourceDark: '/brand-logo.jpg' } });
  if (favicon) favicon.href = '/brand-logo.jpg';
  const apiBase = String(import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
  try {
    const response = await fetch(`${apiBase}/public/site`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    const payload = (await response.json()) as PublicSiteResponse;
    const logoUrl = payload.data?.settings?.branding?.logoUrl
      || payload.settings?.branding?.logoUrl;
    if (!logoUrl) return;
    const logo = resolveMediaUrl(logoUrl);
    updatePreferences({ logo: { source: logo, sourceDark: logo } });
    if (favicon) favicon.href = logo;
  } catch {
    // The shared static logo remains visible while the public API is unavailable.
  }
}
