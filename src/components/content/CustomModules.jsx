import { optimizedImageUrl } from '../../utils/media.js';
import { Image } from 'lucide-react';
import { currentLangParam } from '../layout/Header.jsx';
import { HomeServiceProcess, HomeServiceRegions, parseServiceModule } from './HomeServiceModules.jsx';

const companyOverviewModuleIds = new Set([
  'company-overview',
  'company-core-business',
  'company-vehicle-exports',
  'company-parts-exports',
  'company-core-strengths',
]);

const modulePlacements = new Set([
  'BEFORE_ABOUT',
  'AFTER_VIDEOS',
  'HOME_AFTER_FEATURES',
  'ABOUT_AFTER_INTRO',
]);

function localizedField(value, lang, fallback = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[currentLangParam(lang)] || value.zh || value.en || value.ru || fallback;
  }
  return value || fallback;
}

function CustomModuleMedia({ module, title }) {
  if (module.mediaType === 'VIDEO' && module.video) {
    return (
      <div className="custom-content-media custom-content-video">
        <video src={module.video} poster={optimizedImageUrl(module.poster)} controls preload="metadata" />
      </div>
    );
  }
  if (module.mediaType === 'IMAGE' && module.image) {
    return (
      <figure className="custom-content-media custom-content-image">
        <img src={optimizedImageUrl(module.image)} alt={title} loading="lazy" />
      </figure>
    );
  }
  return null;
}

const coreStrengthsPlaceholder = {
  zh: { label: '媒体展示位', hint: '可在后台上传图片或视频' },
  en: { label: 'Media placeholder', hint: 'Add an image or video in the admin panel' },
  ru: { label: 'Место для медиа', hint: 'Добавьте фото или видео в панели управления' },
};

function CoreStrengthsPlaceholder({ lang }) {
  const copy = coreStrengthsPlaceholder[currentLangParam(lang)] || coreStrengthsPlaceholder.en;
  return <div className="custom-content-media custom-content-placeholder" aria-label={copy.label}>
    <Image className="custom-content-placeholder-icon" size={32} strokeWidth={1.5} aria-hidden="true" />
    <strong>{copy.label}</strong>
    <span>{copy.hint}</span>
  </div>;
}

export function CustomModules({ modules, lang, currentPage, placement, processImage }) {
  const items = (Array.isArray(modules) ? modules : []).filter((module) => {
    if (!module || module.enabled === false) return false;
    const modulePlacement = modulePlacements.has(module.placement) ? module.placement : 'AFTER_VIDEOS';
    const displayScope = module.displayScope === 'HOME' || module.displayScope === 'ABOUT'
      ? module.displayScope
      : 'BOTH';
    const visibleOnCurrentPage = displayScope === 'BOTH'
      || (displayScope === 'HOME' && currentPage === 'home')
      || (displayScope === 'ABOUT' && currentPage === 'about');
    if (modulePlacement !== placement || !visibleOnCurrentPage) return false;
    return Boolean(
      localizedField(module.titleI18n, lang, '')
      || localizedField(module.bodyHtmlI18n, lang, '')
      || module.image
      || module.video,
    );
  });
  if (!items.length) return null;

  const isHomePlacement = placement === 'HOME_AFTER_FEATURES';
  const placementClass = placement === 'BEFORE_ABOUT'
    ? ' custom-content-section--before-about'
    : placement === 'HOME_AFTER_FEATURES'
      ? ' custom-content-section--home'
      : placement === 'ABOUT_AFTER_INTRO'
        ? ' custom-content-section--about-after-intro'
        : '';

  return (
    <>
      {items.map((module, index) => {
        const title = localizedField(module.titleI18n, lang, '');
        const bodyHtml = localizedField(module.bodyHtmlI18n, lang, '');
        const buttonLabel = localizedField(module.button?.label, lang, '');
        const href = module.button?.href || '';
        const hasMedia = Boolean(module.image || module.video);
        const hasCorePlaceholder = module.id === 'company-core-strengths' && !hasMedia;
        const supportsProcessImage = module.id === 'home-service-process' && module.mediaType === 'IMAGE';
        const serviceContent = isHomePlacement && (!hasMedia || supportsProcessImage) ? parseServiceModule(bodyHtml, module.id) : null;
        if (module.id === 'home-service-process' && title && serviceContent) {
          return <HomeServiceProcess key={module.id} module={module} title={title} entries={serviceContent.entries} lang={lang} contentKey={bodyHtml} image={supportsProcessImage ? module.image : processImage} />;
        }
        if (module.id === 'home-service-regions' && title && serviceContent) {
          return <HomeServiceRegions key={module.id} module={module} title={title} intro={serviceContent.intro} entries={serviceContent.entries} lang={lang} buttonLabel={buttonLabel} href={href} contentKey={bodyHtml} />;
        }
        const isCompanyOverviewModule = companyOverviewModuleIds.has(module.id);
        const mediaFirst = placement === 'BEFORE_ABOUT'
          ? false
          : hasMedia && index % 2 === 1;
        const containerClass = isHomePlacement ? 'container' : 'about-container';
        const moduleClass = module.id ? ` custom-content-module--${module.id}` : '';
        return (
          <section
            key={module.id || `custom-${index}`}
            id={`custom-${module.id || index + 1}`}
            className={`custom-content-section${hasMedia || hasCorePlaceholder ? '' : ' custom-content-section--text'}${placementClass}${moduleClass}${isCompanyOverviewModule ? ' custom-content-section--company-overview' : ''}`}
          >
            <div className={`${containerClass} custom-content-layout`}>
              {mediaFirst ? <CustomModuleMedia module={module} title={title} /> : null}
              <div className="custom-content-copy">
                {title ? <h2>{title}</h2> : null}
                {bodyHtml ? <div className={`custom-content-rich-text${isCompanyOverviewModule ? ' custom-content-rich-text--company-overview' : ''}`} dangerouslySetInnerHTML={{ __html: bodyHtml }} /> : null}
                {buttonLabel && href ? <a
                  className="custom-content-button"
                  href={href}
                  target={/^https?:\/\//i.test(href) ? '_blank' : undefined}
                  rel={/^https?:\/\//i.test(href) ? 'noreferrer' : undefined}
                >{buttonLabel}</a> : null}
              </div>
              {!mediaFirst ? hasCorePlaceholder ? <CoreStrengthsPlaceholder lang={lang} /> : <CustomModuleMedia module={module} title={title} /> : null}
            </div>
          </section>
        );
      })}
    </>
  );
}
