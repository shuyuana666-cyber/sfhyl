// Structural fallback only. Business content comes from the public API and
// remains editable in the administration UI.
export const defaultSiteContent = {
  home: {
    heroSlides: [],
    featuredVideo: { src: '', poster: '', title: '', badge: '' },
    rates: { cnyRub: '—', cnyUsd: '—', cnyEur: '—' },
    vehicles: [],
    brands: [],
  },
  about: {
    heroSlides: [],
    paragraphs: [],
    aboutVideo: null,
    transportImages: [],
    staff: [],
    videos: [],
    footerAddresses: [],
  },
};

export function cloneDefaultSiteContent() {
  return structuredClone(defaultSiteContent);
}
