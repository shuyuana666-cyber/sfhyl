import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { fallbackSiteContent } from '../services/siteContent.js';
import { Header, currentLangParam, withLang } from '../components/layout/Header.jsx';
import { CustomModules } from '../components/content/CustomModules.jsx';
import { RichSiteFooter } from '../components/layout/RichSiteFooter.jsx';
import { optimizedImageUrl } from '../utils/media.js';

function localizedField(value, lang, fallback = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[currentLangParam(lang)] || value.zh || value.en || value.ru || fallback;
  }
  return value || fallback;
}

function localizedAboutParagraphs(paragraphs, lang) {
  return (paragraphs || []).map((paragraph) => localizedField(paragraph, lang));
}

function localizedAboutVideo(video, lang) {
  if (!video) return null;
  return { ...video, title: localizedField(video.titleI18n, lang, video.title) };
}

function localizedMediaItems(items, lang) {
  return (items || []).map((item) => ({
    ...item,
    title: localizedField(item.titleI18n, lang, item.title),
  }));
}

function localizedStaffItems(staffItems, lang) {
  return (staffItems || []).map((person) => ({
    ...person,
    name: localizedField(person.nameI18n, lang, person.name),
    role: localizedField(person.roleI18n, lang, person.role),
    description: localizedField(person.descriptionI18n, lang, person.description),
  }));
}

function AboutHero({ slides, lang, t }) {
  const configuredSlides = slides?.length ? slides : [];
  const heroSlides = configuredSlides.length ? configuredSlides : fallbackSiteContent.about.heroSlides;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = heroSlides[activeIndex] || heroSlides[0];
  const activeTitle = localizedField(activeSlide?.titleI18n, lang, activeSlide?.title || t.aboutTitle);
  const fallbackSlide = fallbackSiteContent.about.heroSlides[0];
  const fallbackImage = fallbackSlide?.image || '';
  const [heroImage, setHeroImage] = useState(fallbackImage);

  useEffect(() => {
    const nextImage = activeSlide?.image;
    if (!nextImage) {
      setHeroImage(fallbackImage);
      return undefined;
    }

    // Keep a known-good image on screen until an API-managed slide has decoded.
    // This prevents the carousel from looking empty while a remote WebP is loading.
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setHeroImage(nextImage);
    };
    image.onerror = () => {
      if (!cancelled) setHeroImage(fallbackImage);
    };
    image.src = optimizedImageUrl(nextImage);
    if (image.complete && image.naturalWidth > 0) setHeroImage(nextImage);

    return () => {
      cancelled = true;
    };
  }, [activeSlide?.image, fallbackImage]);

  useEffect(() => {
    if (heroSlides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % heroSlides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const changeSlide = (direction) => {
    setActiveIndex((index) => (index + direction + heroSlides.length) % heroSlides.length);
  };
  return (
    <section className="about-hero" aria-label={t.aboutTitle}>
      {heroImage ? <img src={optimizedImageUrl(heroImage)} alt={activeTitle} fetchPriority="high" decoding="async" onError={() => setHeroImage(fallbackImage)} /> : <div className="about-hero-fallback">SFHYL.CN</div>}
      <button className="hero-arrow hero-prev" type="button" aria-label="Previous slide" onClick={() => changeSlide(-1)}>
        <ChevronLeft size={24} />
      </button>
      <button className="hero-arrow hero-next" type="button" aria-label="Next slide" onClick={() => changeSlide(1)}>
        <ChevronRight size={24} />
      </button>
      <div className="hero-dots" aria-hidden="true">
        {heroSlides.map((slide, index) => (
          <span key={`${slide.image}-${index}`} className={index === activeIndex ? 'active' : ''} />
        ))}
      </div>
    </section>
  );
}

const companyProfileCopy = {
  zh: { vehicles: '浏览车辆目录', contact: '联系我们' },
  en: { vehicles: 'Browse vehicle catalogue', contact: 'Contact us' },
  ru: { vehicles: 'Каталог автомобилей', contact: 'Связаться с нами' },
};

function AboutIntro({ paragraphs, video, titleI18n, bodyHtmlI18n, site, t, lang }) {
  const aboutVideo = localizedAboutVideo(video, lang);
  const localizedParagraphs = localizedAboutParagraphs(paragraphs, lang);
  const language = currentLangParam(lang);
  const profile = companyProfileCopy[language] || companyProfileCopy.en;
  const basic = site?.settings?.basic || {};
  const companyName = language === 'zh'
    ? basic.companyNameZh || basic.siteNameZh
    : basic.companyNameEn || basic.siteNameEn || basic.siteNameRu;
  const title = localizedField(titleI18n, lang, t.aboutTitle);
  const bodyHtml = localizedField(bodyHtmlI18n, lang, '');
  return (
    <section id="about" className="about-intro about-container">
      <div className="about-copy">
        {companyName ? <p className="about-company-name">{companyName}</p> : null}
        <h1>{title}</h1>
        {bodyHtml
          ? <div className="about-rich-text" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          : localizedParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <div className="about-intro-actions">
          <a className="about-more" href={withLang('/vehicles', lang)}>{profile.vehicles}<ArrowRight size={17} /></a>
          <a className="about-contact-action" href={withLang('/contact', lang)}>{profile.contact}<ArrowRight size={17} /></a>
        </div>
      </div>
      {aboutVideo?.src ? <div className="about-video-frame">
        <span className="about-video-title">{aboutVideo.title}</span>
        <span className="about-video-badge">{aboutVideo.badge}</span>
        <video src={aboutVideo.src} controls preload="metadata" poster={optimizedImageUrl(aboutVideo.poster)} />
      </div> : null}
    </section>
  );
}

function TransportSection({ images, titleI18n, t, lang }) {
  const items = localizedMediaItems(images, lang);
  if (!items.length) return null;
  return (
    <section id="fahuo" className="about-section about-container">
      <h2>{localizedField(titleI18n, lang, t.transportTitle)}</h2>
      <div className="transport-carousel">
        {items.slice(0, 3).map((item, index) => (
          <figure key={`${item.image}-${index}`} className="transport-item"><img src={optimizedImageUrl(item.image)} alt={item.title || `${t.transportTitle} ${index + 1}`} loading="lazy" />{item.descriptionI18n && <figcaption>{localizedField(item.descriptionI18n, lang, '')}</figcaption>}</figure>
        ))}
      </div>
      <div className="section-dots" aria-hidden="true">
        <span />
        <span className="active" />
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function StaffSection({ staffItems, titleI18n, t, lang }) {
  const items = localizedStaffItems(staffItems, lang);
  if (!items.length) return null;
  return (
    <section id="yuangong" className="staff-section">
      <h2>{localizedField(titleI18n, lang, t.staffTitle)}</h2>
      <div className="staff-band">
        <span className="staff-shape shape-left" />
        <span className="staff-shape shape-right" />
        <div className="staff-grid about-container">
          {items.map((person) => (
            <figure key={person.name} className="staff-card">
              <img src={optimizedImageUrl(person.image)} alt={person.name} loading="lazy" />
              <figcaption><strong>{person.name}</strong>{person.role && <span>{person.role}</span>}{person.description && <small>{person.description}</small>}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoSection({ videoItems, titleI18n, t, lang }) {
  const items = localizedMediaItems(videoItems, lang);
  if (!items.length) return null;
  return (
    <section id="shipin" className="video-gallery-section">
      <h2>{localizedField(titleI18n, lang, t.videoTitle)}</h2>
      <div className="video-grid about-container">
        {items.map((video, index) => (
          <div className="video-card" key={video.src}>
            <video src={video.src} poster={optimizedImageUrl(video.poster)} controls preload="none" />
            <button className="video-play-overlay" type="button" aria-label={video.title || `${t.videoTitle} ${index + 1}`}>
              <Play size={28} fill="currentColor" />
            </button>
            {video.title && <p>{video.title}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function AboutPage({ content, site, lang, setLang, t, currentPage = 'about' }) {
  const aboutContent = content || fallbackSiteContent.about;
  const useFallback = aboutContent.managed !== true;
  const sectionEnabled = aboutContent.sectionEnabled || {};
  const visible = (section) => useFallback || sectionEnabled[section] !== false;
  return (
    <div id="top" className="app about-page">
      <Header currentPage={currentPage} site={site} lang={lang} setLang={setLang} t={t} />
      <main>
        {visible('hero') ? <AboutHero slides={aboutContent.heroSlides} lang={lang} t={t} /> : null}
        <CustomModules
          modules={aboutContent.customModules}
          lang={lang}
          currentPage={currentPage}
          placement="BEFORE_ABOUT"
        />
        {visible('about') ? <AboutIntro
          paragraphs={aboutContent.paragraphs}
          video={aboutContent.aboutVideo}
          titleI18n={aboutContent.titleI18n}
          bodyHtmlI18n={aboutContent.bodyHtmlI18n}
          site={site}
          t={t}
          lang={lang}
        /> : null}
        <CustomModules
          modules={aboutContent.customModules}
          lang={lang}
          currentPage="about"
          placement="ABOUT_AFTER_INTRO"
        />
        {visible('transport') ? <TransportSection images={aboutContent.transportImages} titleI18n={aboutContent.transportTitleI18n} t={t} lang={lang} /> : null}
        {visible('staff') ? <StaffSection staffItems={aboutContent.staff} titleI18n={aboutContent.staffTitleI18n} t={t} lang={lang} /> : null}
        {visible('videos') ? <VideoSection videoItems={aboutContent.videos} titleI18n={aboutContent.videosTitleI18n} t={t} lang={lang} /> : null}
        <CustomModules
          modules={aboutContent.customModules}
          lang={lang}
          currentPage={currentPage}
          placement="AFTER_VIDEOS"
        />
      </main>
      <RichSiteFooter about={aboutContent} site={site} t={t} lang={lang} onAboutPage />
    </div>
  );
}
