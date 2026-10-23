import { useCallback, useEffect, useState } from 'react';
import { fallbackSiteContent, normalizeSiteContent } from '../services/siteContent.js';
import {
  loadPublicAbout,
  loadPublicBrands,
  loadPublicHome,
  loadPublicSite,
  loadPublicVehicles,
} from '../services/platformApi.js';

function fallbackContentWithoutNavigation(navigation) {
  return {
    ...fallbackSiteContent,
    home: { ...(fallbackSiteContent.home || {}), vehicles: [] },
    site: { ...(fallbackSiteContent.site || {}), navigation },
  };
}

function loadingContentWithoutNavigation(navigation) {
  return {
    ...fallbackContentWithoutNavigation(navigation),
    about: {
      managed: true,
      sectionEnabled: {
        hero: false,
        about: false,
        transport: false,
        staff: false,
        videos: false,
        quickNav: false,
        locations: false,
      },
      heroSlides: [],
      paragraphs: [],
      aboutVideo: null,
      transportImages: [],
      staff: [],
      videos: [],
      quickNav: { title: {}, items: [] },
      footerAddresses: [],
    },
  };
}

function useSiteContent() {
  const [content, setContent] = useState(() => loadingContentWithoutNavigation(null));
  const [status, setStatus] = useState('loading');
  const [vehicleStatus, setVehicleStatus] = useState('loading');
  const [loadVersion, setLoadVersion] = useState(0);
  const reload = useCallback(() => setLoadVersion((version) => version + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const { signal } = controller;
    setStatus('loading');
    setVehicleStatus('loading');
    setContent(loadingContentWithoutNavigation(null));

    Promise.allSettled([
      loadPublicSite({ signal }),
      loadPublicHome({ signal }),
      loadPublicAbout({ signal }),
      loadPublicBrands({ signal }),
    ])
      .then(([siteResult, homeResult, aboutResult, brandsResult]) => {
        if (cancelled) return;
        const site = siteResult.status === 'fulfilled' ? siteResult.value : fallbackSiteContent.site;
        const home = homeResult.status === 'fulfilled'
          ? homeResult.value
          : { ...fallbackSiteContent.home, vehicles: [] };
        const about = aboutResult.status === 'fulfilled' ? aboutResult.value : undefined;
        const brands = brandsResult.status === 'fulfilled' ? brandsResult.value : [];
        const baseFailed = [siteResult, homeResult, aboutResult].every((result) => result.status === 'rejected');
        setContent(normalizeSiteContent({ site, home: { ...home, vehicles: [], brands }, about }));
        setStatus(baseFailed ? 'fallback' : 'ready');

        return loadPublicVehicles({ signal })
          .then((vehicles) => {
            if (cancelled) return;
            setContent((current) => normalizeSiteContent({
              ...current,
              home: { ...current.home, vehicles },
            }));
            setVehicleStatus('ready');
          })
          .catch(() => {
            if (!cancelled) setVehicleStatus('fallback');
          });
      })
      .catch(() => {
        if (!cancelled) {
          setContent(fallbackContentWithoutNavigation([]));
          setStatus('fallback');
          setVehicleStatus('fallback');
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadVersion]);

  return { content, status, vehicleStatus, reload };
}

export { useSiteContent };
