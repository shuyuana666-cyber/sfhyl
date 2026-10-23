function localized(zh, en, ru) {
  return {
    zh: zh || en || ru || '',
    en: en || zh || ru || '',
    ru: ru || en || zh || '',
  };
}

function mediaUrl(media) {
  const value = media?.webpUrl || media?.url || '';
  return normalizePublicMediaUrl(value);
}

export function normalizePublicMediaUrl(value) {
  if (typeof value !== 'string') return '';

  const mediaPath = String(import.meta.env.VITE_MEDIA_BASE_PATH || '/media').replace(/\/$/, '');
  const legacyBucket = String(import.meta.env.VITE_LEGACY_MEDIA_BUCKET || 'sfhyl');
  const legacyPort = String(import.meta.env.VITE_LEGACY_MEDIA_PORT || '9200');
  try {
    const url = new URL(value);
    if (url.pathname.startsWith(`${mediaPath}/`)) return `${url.pathname}${url.search}${url.hash}`;
    const bucketPath = `/${legacyBucket}/`;
    if (/^(localhost|127\.0\.0\.1)$/i.test(url.hostname) && url.port === legacyPort && url.pathname.startsWith(bucketPath)) {
      return `${mediaPath}/${url.pathname.slice(bucketPath.length)}${url.search}${url.hash}`;
    }
  } catch {
    // Relative media paths are already safe to use as-is.
  }

  return value;
}

export function mapPublicVehicle(vehicle) {
  const media = Array.isArray(vehicle.media) ? vehicle.media : [];
  const gallery = media
    .filter((item) => mediaUrl(item?.media) && item.type !== 'VIDEO')
    .map((item) => mediaUrl(item.media));
  const cover = mediaUrl(vehicle.coverMedia) || gallery[0] || '';
  const modelName = vehicle.model?.nameEn || vehicle.series?.nameEn || vehicle.nameEn || vehicle.nameZh || '';
  const shortModelName = modelName.trim().split(/\s+/).slice(0, 2).join(' ');

  return {
    id: vehicle.slug || String(vehicle.id),
    databaseId: String(vehicle.id),
    legacyId: vehicle.legacyId || String(vehicle.id),
    slug: vehicle.slug,
    stockNo: vehicle.stockNo,
    brand: vehicle.brand?.nameEn || vehicle.brand?.nameZh || '',
    brandI18n: localized(vehicle.brand?.nameZh, vehicle.brand?.nameEn, vehicle.brand?.nameRu),
    model: shortModelName,
    title: vehicle.nameEn || vehicle.nameZh,
    titleI18n: localized(vehicle.nameZh, vehicle.nameEn, vehicle.nameRu),
    description: vehicle.shortDescriptionEn || vehicle.descriptionEn || vehicle.shortDescriptionZh || '',
    descriptionI18n: localized(
      vehicle.descriptionZh || vehicle.shortDescriptionZh,
      vehicle.descriptionEn || vehicle.shortDescriptionEn,
      vehicle.descriptionRu || vehicle.shortDescriptionRu,
    ),
    image: cover,
    gallery: gallery.length ? gallery : cover ? [cover] : [],
    price: Number(vehicle.price || 0),
    originalPrice: vehicle.originalPrice ? Number(vehicle.originalPrice) : null,
    currency: vehicle.currency || 'CNY',
    showPrice: vehicle.showPrice !== false,
    showInquiryPrice: vehicle.showInquiryPrice !== false,
    rub: vehicle.priceNote || '',
    year: Number(vehicle.year || 0),
    mileage: Number(vehicle.mileage || 0),
    mileageUnit: vehicle.mileageUnit || 'KM',
    engine: vehicle.engineModel || vehicle.fuelType || '',
    transmission: vehicle.transmission || '',
    fuel: vehicle.fuelType || '',
    bodyType: vehicle.bodyType || '',
    drive: vehicle.driveType || '',
    color: vehicle.exteriorColor || '',
    volume: vehicle.displacement ? `${vehicle.displacement} L` : '',
    power: vehicle.enginePower || '',
    vin: vehicle.vin || '',
    location: vehicle.location || '',
    isFeatured: vehicle.isFeatured === true,
    isHomepage: vehicle.isHomepage === true,
    highlights: vehicle.highlights || [],
    specifications: vehicle.specifications || {},
    saleStatus: vehicle.saleStatus,
  };
}

export function mapHome(home, vehicles = []) {
  const videoSection = home.sections?.find((item) => item.type === 'VIDEO');
  const videoConfig = videoSection?.config || {};

  return {
    heroSlides: (home.banners || []).map((banner, index) => ({
      image: mediaUrl(banner.desktopMedia) || mediaUrl(banner.mobileMedia),
      mobileImage: mediaUrl(banner.mobileMedia),
      title: banner.titleEn || banner.titleZh || '',
      titleI18n: localized(banner.titleZh, banner.titleEn, banner.titleRu),
      subtitleI18n: localized(banner.subtitleZh, banner.subtitleEn, banner.subtitleRu),
      href: banner.linkUrl || '',
      active: index === 0,
    })).filter((item) => item.image),
    featuredVideo: {
      title: videoSection?.titleEn || videoSection?.titleZh || '',
      badge: videoSection?.subtitleEn || '',
      src: videoConfig.videoUrl || '',
      poster: mediaUrl(videoSection?.backgroundMedia),
    },
    sections: (home.sections || []).map(section => ({
      ...section,
      recommendations: (section.recommendations || []).map(item => ({
        ...item,
        vehicle: item.vehicle ? mapPublicVehicle(item.vehicle) : null,
      })),
    })),
    features: (home.features || []).map((feature) => ({
      ...feature,
      imageMedia: feature.imageMedia
        ? { ...feature.imageMedia, url: mediaUrl(feature.imageMedia) }
        : feature.imageMedia,
    })),
    vehicles,
  };
}

function mapAbout(page) {
  if (!page) return undefined;

  const content = page.content && typeof page.content === 'object' ? page.content : {};
  return {
    titleI18n: localized(page.titleZh, page.titleEn, page.titleRu),
    summaryI18n: localized(page.summaryZh, page.summaryEn, page.summaryRu),
    bodyHtmlI18n: { zh: content.zh || '', en: content.en || '', ru: content.ru || '' },
    ogImage: mediaUrl(page.ogMedia),
  };
}

function mapHeroSlides(content, mediaUrlById) {
  return (content.hero || [])
    .filter((item) => item.enabled !== false)
    .map((item) => ({
      image: mediaUrlById(item.imageMediaId),
      mobileImage: mediaUrlById(item.mobileMediaId),
      titleI18n: item.title || {},
      active: true,
    }))
    .filter((item) => item.image);
}

function mapCustomModules(modules, mediaUrlById) {
  const placements = new Set([
    'BEFORE_ABOUT',
    'AFTER_VIDEOS',
    'HOME_AFTER_FEATURES',
    'ABOUT_AFTER_INTRO',
  ]);
  return modules
    .filter((item) => item?.enabled !== false)
    .map((item, index) => {
      const mediaType = item.mediaType === 'IMAGE' || item.mediaType === 'VIDEO'
        ? item.mediaType
        : 'NONE';

      return {
        id: item.id || `custom-${index + 1}`,
        enabled: true,
        placement: placements.has(item.placement) ? item.placement : 'AFTER_VIDEOS',
        displayScope: item.displayScope === 'HOME' || item.displayScope === 'ABOUT'
          ? item.displayScope
          : 'BOTH',
        titleI18n: item.title || {},
        bodyHtmlI18n: item.body || {},
        mediaType,
        image: mediaType === 'IMAGE' ? mediaUrlById(item.imageMediaId) : '',
        stageImages: (item.stageImages || []).map(stage => mediaUrlById(stage?.imageMediaId)),
        video: mediaType === 'VIDEO' ? mediaUrlById(item.videoMediaId) : '',
        poster: mediaType === 'VIDEO' ? mediaUrlById(item.posterMediaId) : '',
        button: item.button || undefined,
      };
    });
}

export function mapHomepageContent(payload) {
  if (!payload?.content) return undefined;

  const content = payload.content;
  const media = payload.media || {};
  const mediaUrlById = (id) => (id ? mediaUrl(media[String(id)]) : '');
  const sectionEnabled = {
    hero: content.heroEnabled !== false,
    about: content.about?.enabled !== false,
    transport: content.transport?.enabled !== false,
    staff: content.staff?.enabled !== false,
    videos: content.videos?.enabled !== false,
    quickNav: content.quickNav?.enabled !== false,
    locations: content.locations?.enabled !== false,
  };

  return {
    managed: content.managed === true,
    sectionEnabled,
    heroSlides: sectionEnabled.hero ? mapHeroSlides(content, mediaUrlById) : [],
    bodyHtmlI18n: content.about?.body || {},
    titleI18n: content.about?.title || {},
    aboutButton: content.about?.button || undefined,
    aboutVideo: sectionEnabled.about && content.about?.videoMediaId
      ? {
          src: mediaUrlById(content.about.videoMediaId),
          poster: mediaUrlById(content.about.posterMediaId),
          title: '',
          badge: '',
        }
      : null,
    transportTitleI18n: content.transport?.title || {},
    transportImages: sectionEnabled.transport
      ? (content.transport?.items || [])
          .map((item) => ({
            image: mediaUrlById(item.imageMediaId),
            titleI18n: item.title || {},
            descriptionI18n: item.description || {},
          }))
          .filter((item) => item.image)
      : [],
    staffTitleI18n: content.staff?.title || {},
    staff: sectionEnabled.staff
      ? (content.staff?.items || [])
          .map((item) => ({
            image: mediaUrlById(item.imageMediaId),
            nameI18n: item.name || {},
            roleI18n: item.role || {},
            descriptionI18n: item.description || {},
          }))
          .filter((item) => item.image)
      : [],
    videosTitleI18n: content.videos?.title || {},
    videos: sectionEnabled.videos
      ? (content.videos?.items || [])
          .map((item) => ({
            src: mediaUrlById(item.videoMediaId),
            poster: mediaUrlById(item.posterMediaId),
            titleI18n: item.title || {},
          }))
          .filter((item) => item.src)
      : [],
    quickNav: sectionEnabled.quickNav
      ? content.quickNav || undefined
      : { title: content.quickNav?.title || {}, items: [] },
    locationsTitleI18n: content.locations?.title || {},
    footerAddresses: sectionEnabled.locations
      ? (content.locations?.items || [])
          .filter((item) => item.enabled !== false)
          .map((item) => ({ ...item, addressI18n: item.address || {} }))
      : [],
    customModules: mapCustomModules(content.customModules || [], mediaUrlById),
  };
}

export { mapAbout };
