import { cloneDefaultSiteContent } from "../contentDefaults.js";

export const fallbackSiteContent = cloneDefaultSiteContent();

function normalizeManagedAboutContent(about) {
  return {
    ...(about || {}),
    managed: true,
    sectionEnabled: {
      hero: about?.sectionEnabled?.hero !== false,
      about: about?.sectionEnabled?.about !== false,
      transport: about?.sectionEnabled?.transport !== false,
      staff: about?.sectionEnabled?.staff !== false,
      videos: about?.sectionEnabled?.videos !== false,
      quickNav: about?.sectionEnabled?.quickNav !== false,
      locations: about?.sectionEnabled?.locations !== false,
    },
    heroSlides: Array.isArray(about?.heroSlides) ? about.heroSlides : [],
    paragraphs: Array.isArray(about?.paragraphs) ? about.paragraphs : [],
    aboutVideo: about?.aboutVideo?.src ? about.aboutVideo : null,
    transportImages: Array.isArray(about?.transportImages)
      ? about.transportImages
      : [],
    staff: Array.isArray(about?.staff) ? about.staff : [],
    videos: Array.isArray(about?.videos) ? about.videos : [],
    quickNav: about?.quickNav || { title: {}, items: [] },
    footerAddresses: Array.isArray(about?.footerAddresses)
      ? about.footerAddresses
      : [],
    customModules: Array.isArray(about?.customModules)
      ? about.customModules
      : [],
  };
}

export function normalizeSiteContent(content) {
  const featuredVideo = Object.fromEntries(
    Object.entries(content?.home?.featuredVideo || {}).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    ),
  );
  const about = content?.about?.managed
    ? normalizeManagedAboutContent(content.about)
    : {
        ...fallbackSiteContent.about,
        ...(content?.about || {}),
        heroSlides: content?.about?.heroSlides?.length
          ? content.about.heroSlides
          : fallbackSiteContent.about.heroSlides,
        paragraphs: content?.about?.paragraphs?.length
          ? content.about.paragraphs
          : fallbackSiteContent.about.paragraphs,
        aboutVideo: {
          ...fallbackSiteContent.about.aboutVideo,
          ...(content?.about?.aboutVideo || {}),
        },
        transportImages: content?.about?.transportImages?.length
          ? content.about.transportImages
          : fallbackSiteContent.about.transportImages,
        staff: content?.about?.staff?.length
          ? content.about.staff
          : fallbackSiteContent.about.staff,
        videos: content?.about?.videos?.length
          ? content.about.videos
          : fallbackSiteContent.about.videos,
        footerAddresses: content?.about?.footerAddresses?.length
          ? content.about.footerAddresses
          : fallbackSiteContent.about.footerAddresses,
      };
  return {
    ...fallbackSiteContent,
    ...(content || {}),
    site: content?.site || {},
    home: {
      ...fallbackSiteContent.home,
      ...(content?.home || {}),
      rates: {
        ...fallbackSiteContent.home.rates,
        ...(content?.home?.rates || {}),
      },
      heroSlides: content?.home?.heroSlides?.length
        ? content.home.heroSlides
        : fallbackSiteContent.home.heroSlides,
      featuredVideo: {
        ...fallbackSiteContent.home.featuredVideo,
        ...featuredVideo,
      },
      vehicles: Array.isArray(content?.home?.vehicles)
        ? content.home.vehicles
        : fallbackSiteContent.home.vehicles,
      brands: Array.isArray(content?.home?.brands)
        ? content.home.brands
        : fallbackSiteContent.home.brands,
    },
    about,
  };
}
