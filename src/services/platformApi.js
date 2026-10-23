import { apiRequest } from './apiClient.js';
import {
  mapAbout,
  mapHome,
  mapHomepageContent,
  mapPublicVehicle,
  normalizePublicMediaUrl,
} from './publicContentMapper.js';

export async function loadPublicSite({ signal } = {}) {
  const site = await apiRequest('/public/site', { signal });
  const branding = site?.settings?.branding;
  if (!branding) return site;
  return {
    ...site,
    settings: {
      ...site.settings,
      branding: Object.fromEntries(Object.entries(branding).map(([key, value]) => [
        key,
        /Url$/.test(key) ? normalizePublicMediaUrl(value) : value,
      ])),
    },
  };
}

export async function loadPublicHome({ signal } = {}) {
  return mapHome(await apiRequest('/public/home', { signal }));
}

export async function loadPublicBrands({ signal } = {}) {
  const brands = await apiRequest('/public/brands', { signal });
  return (Array.isArray(brands) ? brands : []).map((brand) => ({
    id: String(brand.id),
    slug: brand.slug,
    nameZh: brand.nameZh,
    nameEn: brand.nameEn,
    nameRu: brand.nameRu,
    logoUrl: normalizePublicMediaUrl(brand.logoMedia?.url),
  }));
}

export async function loadPublicAbout({ signal } = {}) {
  let homepageContent = null;

  try {
    homepageContent = await apiRequest('/public/homepage-content', { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  const homepageAbout = mapHomepageContent(homepageContent);
  if (homepageAbout) return homepageAbout;

  try {
    const aboutPage = await apiRequest('/public/pages/about', { signal });
    return mapAbout(aboutPage);
  } catch (error) {
    if (signal?.aborted) throw error;
    return undefined;
  }
}

export async function loadPublicVehicles({ timeoutMs, signal } = {}) {
  const vehiclePage = await apiRequest(
    '/public/vehicles?page=1&pageSize=100&sortBy=sortOrder&sortOrder=asc',
    { timeoutMs, signal },
  );

  return (vehiclePage.items || []).map(mapPublicVehicle);
}

export async function loadPlatformContent({ signal } = {}) {
  const [site, home, vehicles, about, brands] = await Promise.all([
    loadPublicSite({ signal }),
    loadPublicHome({ signal }),
    loadPublicVehicles({ signal }),
    loadPublicAbout({ signal }),
    loadPublicBrands({ signal }),
  ]);

  return {
    site,
    home: { ...home, vehicles, brands },
    ...(about ? { about } : {}),
  };
}

export async function loadPublicVehicle(slug, { signal } = {}) {
  const vehicle = await apiRequest(
    `/public/vehicles/${encodeURIComponent(slug)}`,
    { signal },
  );
  return mapPublicVehicle(vehicle);
}

export function submitInquiry(data, customerToken) {
  return apiRequest(customerToken ? '/public/auth/inquiries' : '/public/inquiries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
    },
    body: JSON.stringify(data),
  });
}
