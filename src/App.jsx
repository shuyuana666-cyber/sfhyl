import { useEffect } from 'react';
import { AppRoutes } from './routes/AppRoutes.jsx';
import { useLanguage } from './hooks/useLanguage.js';
import { useSiteContent } from './hooks/useSiteContent.js';

export default function App() {
  const { content, status, vehicleStatus, reload } = useSiteContent();
  const { lang, setLang, t } = useLanguage();
  const settings = content.site?.settings || {};

  useEffect(() => {
    const basic = settings.basic || {};
    const seo = settings.seo || {};
    const branding = settings.branding || {};
    const localizedName = lang === 'zh' ? basic.siteNameZh : lang === 'ru' ? basic.siteNameRu : basic.siteNameEn;
    document.title = seo.defaultTitle || localizedName || basic.siteNameEn || 'SFHYL.CN';

    const description = seo.defaultDescription || basic.siteDescription;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.append(meta);
      }
      meta.setAttribute('content', description);
    }

    if (branding.faviconUrl) {
      let favicon = document.querySelector('link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.setAttribute('rel', 'icon');
        document.head.append(favicon);
      }
      favicon.setAttribute('href', branding.faviconUrl);
    }
  }, [lang, settings]);

  if (status === 'ready' && settings.features?.maintenanceMode) {
    return (
      <main className="maintenance-page">
        <strong>{settings.basic?.siteNameEn || 'SFHYL.CN'}</strong>
        <p>{settings.features.maintenanceMessage || 'Service is temporarily unavailable.'}</p>
      </main>
    );
  }

  return <AppRoutes content={content} vehicleStatus={vehicleStatus} reload={reload} lang={lang} setLang={setLang} t={t} />;
}
