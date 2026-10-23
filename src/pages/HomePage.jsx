import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Car, ChevronLeft, ChevronRight, Headphones, ShieldCheck, Ship, Star, Truck, Users } from 'lucide-react';
import { fallbackSiteContent } from '../services/siteContent.js';
import { Header, currentLangParam, withLang } from '../components/layout/Header.jsx';
import { RichSiteFooter } from '../components/layout/RichSiteFooter.jsx';
import { CustomModules } from '../components/content/CustomModules.jsx';
import { mileageRanges, priceRanges, yearRangesForVehicles } from '../utils/catalog.js';
import { translations } from '../i18n/language.js';
import { useExchangeRates } from '../hooks/useExchangeRates.js';
import { optimizedImageUrl } from '../utils/media.js';
import { formatCurrency, hasDisplayablePrice } from '../utils/currency.js';
import { filtersFromUrl, normalizeModelParam, slugifyModel, vehicleModelLabel } from '../utils/homeFilters.js';
import { SearchPanel } from '../components/home/SearchPanel.jsx';
import { selectHomepageVehicles } from '../../shared/homepage-vehicles.ts';

function localizedField(value, lang, fallback = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[currentLangParam(lang)] || value.ru || value.zh || value.en || fallback;
  }
  return value || fallback;
}

function localizedVehicleTitle(vehicle, lang) {
  return localizedField(vehicle?.titleI18n || vehicle?.titleTranslations, lang, vehicle?.title || '');
}

const formatMileage = (value, lang = 'ru') => `${translations[lang].mileagePrefix} ${value.toLocaleString('en-US')}km`;
const inquiryPriceLabels = { zh: '询价', en: 'Inquire', ru: 'По запросу' };
const soldLabels = { zh: '已售', en: 'Sold', ru: 'Продано' };
const homeCopy = {
  zh: {
    eyebrow: 'SFHYL.CN · 中国汽车出口与跨境物流',
    heroTitle: '从中国选车，到跨境交付',
    about: '关于 SFHYL.CN',
    aboutAction: '了解我们的服务',
    fleetTitle: '精选车辆',
    fleetCopy: '查看当前发布的车型、配置与价格。',
    fleetEmpty: '车辆信息正在整理中，欢迎联系我们获取最新目录。',
    aboutLink: '关于我们',
  },
  en: {
    eyebrow: 'SFHYL.CN · VEHICLE EXPORT & CROSS-BORDER LOGISTICS',
    heroTitle: 'Source in China. Deliver across borders.',
    about: 'About SFHYL.CN',
    aboutAction: 'How we work',
    fleetTitle: 'Featured vehicles',
    fleetCopy: 'Explore currently published vehicles and specifications.',
    fleetEmpty: 'Our latest inventory is being prepared. Contact us for the current catalogue.',
    aboutLink: 'About us',
  },
  ru: {
    eyebrow: 'SFHYL.CN · ЭКСПОРТ АВТОМОБИЛЕЙ И МЕЖДУНАРОДНАЯ ЛОГИСТИКА',
    heroTitle: 'Подбор автомобиля в Китае и доставка за рубеж',
    about: 'О компании SFHYL.CN',
    aboutAction: 'Как мы работаем',
    fleetTitle: 'Актуальные автомобили',
    fleetCopy: 'Посмотрите опубликованные автомобили и их характеристики.',
    fleetEmpty: 'Мы готовим актуальный каталог. Свяжитесь с нами, чтобы узнать о наличии.',
    aboutLink: 'О компании',
  },
};

function homeLabels(lang) {
  return homeCopy[lang] || homeCopy.ru;
}

function detailUrl(vehicle, lang) {
  const url = new URL(`/vehicle/${encodeURIComponent(vehicle.slug || vehicle.id)}`, window.location.origin);
  url.searchParams.set('lang', currentLangParam(lang));
  return `${url.pathname}${url.search}`;
}

function VehicleCard({ vehicle, lang, t }) {
  const href = detailUrl(vehicle, lang);
  const title = localizedVehicleTitle(vehicle, lang);

  return (
    <article className="vehicle-card">
      <a className="image-link" href={href} aria-label={title}>
        <img src={optimizedImageUrl(vehicle.image)} alt={title} loading="lazy" />
        {vehicle.saleStatus === 'SOLD' ? <span className="sold-badge">{soldLabels[lang] || soldLabels.ru}</span> : null}
      </a>
      <div className="vehicle-body">
        <h2>{title}</h2>
        <p className="price">
          {hasDisplayablePrice(vehicle.price) ? formatCurrency(vehicle.price, vehicle.currency) : inquiryPriceLabels[lang] || inquiryPriceLabels.ru}
          <small>{vehicle.rub}</small>
        </p>
        <div className="vehicle-foot">
          <span>{formatMileage(vehicle.mileage, lang)}</span>
          <a href={href}>{t.details}</a>
        </div>
      </div>
    </article>
  );
}

function VehicleCardSkeleton() {
  return (
    <article className="vehicle-card vehicle-skeleton-card" aria-hidden="true">
      <div className="vehicle-skeleton-image" />
      <div className="vehicle-body">
        <span className="vehicle-skeleton-line vehicle-skeleton-title" />
        <span className="vehicle-skeleton-line vehicle-skeleton-price" />
        <span className="vehicle-skeleton-line vehicle-skeleton-meta" />
      </div>
    </article>
  );
}

function Pagination({ page, pageCount, onPage, t }) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={page === 1} onClick={() => onPage(page - 1)} type="button">
        {t.previous}
      </button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
        <button
          key={item}
          className={item === page ? 'active' : ''}
          onClick={() => onPage(item)}
          type="button"
        >
          {item}
        </button>
      ))}
      <button disabled={page === pageCount} onClick={() => onPage(page + 1)} type="button">
        {t.next}
      </button>
    </nav>
  );
}

function pickRange(key, ranges) {
  return ranges.find((range) => range.key === key) ?? ranges[0];
}

function HomeMedia({ slides, lang, t }) {
  const homeSlides = slides?.length ? slides : fallbackSiteContent.about.heroSlides;
  const defaultIndex = Math.max(0, homeSlides.findIndex((slide) => slide.active));
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const [imageFailed, setImageFailed] = useState(false);
  const activeSlide = homeSlides[activeIndex] || homeSlides[0];
  const labels = homeLabels(lang);
  const activeTitle = localizedField(activeSlide?.titleI18n, lang, activeSlide?.title || labels.heroTitle);
  const activeSubtitle = localizedField(activeSlide?.subtitleI18n, lang, t.homeIntroCopy);
  const fallbackSlide = fallbackSiteContent.about.heroSlides[0];
  const heroImage = imageFailed ? fallbackSlide?.image : activeSlide?.image;

  useEffect(() => {
    setActiveIndex(Math.max(0, homeSlides.findIndex((slide) => slide.active)));
    setImageFailed(false);
  }, [homeSlides.length, homeSlides[0]?.image]);

  useEffect(() => {
    if (homeSlides.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % homeSlides.length), 7000);
    return () => window.clearInterval(timer);
  }, [homeSlides.length]);

  const changeSlide = (direction) => {
    setActiveIndex((index) => (index + direction + homeSlides.length) % homeSlides.length);
  };

  return (
    <section className="home-hero" aria-label={labels.eyebrow}>
      {heroImage ? <picture className="home-hero-picture">
        {!imageFailed && activeSlide?.mobileImage ? <source media="(max-width: 720px)" srcSet={optimizedImageUrl(activeSlide.mobileImage)} /> : null}
        <img src={optimizedImageUrl(heroImage)} alt={activeTitle} fetchPriority="high" decoding="async" onError={() => setImageFailed(true)} />
      </picture> : <div className="home-hero-fallback">SFHYL.CN</div>}
      <div className="home-hero-shade" />
      <div className="container home-hero-content">
        <span className="home-hero-eyebrow">{labels.eyebrow}</span>
        <h1>{activeTitle}</h1>
        <p>{activeSubtitle}</p>
        <div className="home-hero-actions">
          <a className="home-primary-action" href={withLang('/vehicles', lang)}>{t.browseVehicles}<ArrowRight size={18} /></a>
          <a className="home-hero-secondary" href={withLang('/about', lang)}>{labels.aboutAction}<ArrowRight size={18} /></a>
        </div>
      </div>
      {activeTitle ? <div className="home-hero-caption"><span>{activeTitle}</span></div> : null}
      {homeSlides.length > 1 ? <>
        <button className="home-slide-arrow home-slide-prev" type="button" aria-label="Previous slide" onClick={() => changeSlide(-1)}><ChevronLeft size={22} /></button>
        <button className="home-slide-arrow home-slide-next" type="button" aria-label="Next slide" onClick={() => changeSlide(1)}><ChevronRight size={22} /></button>
        <div className="home-media-dots">
          {homeSlides.map((slide, index) => (
            <button key={`${slide.image}-${index}`} type="button" aria-label={`Slide ${index + 1}`} aria-current={index === activeIndex} className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)} />
          ))}
        </div>
      </> : null}
    </section>
  );
}

const featureIconMap = {
  headphones: Headphones,
  'ri:customer-service-2-line': Headphones,
  shieldcheck: ShieldCheck,
  'ri:shield-check-line': ShieldCheck,
  ship: Ship,
  'ri:ship-line': Ship,
  users: Users,
  'ri:team-line': Users,
};

function HomeFeatureIcon({ feature }) {
  if (feature.iconType === 'SVG' && feature.svgContent) {
    return <span className="home-feature-svg" dangerouslySetInnerHTML={{ __html: feature.svgContent }} />;
  }
  const Icon = featureIconMap[String(feature.iconName || '').toLowerCase()] || Star;
  return <Icon size={30} strokeWidth={1.8} />;
}

function HomeFeatureCard({ feature, lang }) {
  const title = localizedField({ zh: feature.titleZh, en: feature.titleEn, ru: feature.titleRu }, lang, feature.titleEn);
  const description = localizedField({ zh: feature.descriptionZh, en: feature.descriptionEn, ru: feature.descriptionRu }, lang, feature.descriptionEn);
  const imageUrl = feature.iconType === 'IMAGE' && feature.imageMedia?.url
    ? optimizedImageUrl(feature.imageMedia.url) : '';
  const [failedUrl, setFailedUrl] = useState(null);
  const sceneLabel = { zh: '服务场景示意', en: 'Illustrative service scene', ru: 'Иллюстрация обслуживания' };
  const content = <>
    <span className="home-feature-media">
      {imageUrl && failedUrl !== imageUrl
        ? <img src={imageUrl} alt={`${title} · ${sceneLabel[lang] || sceneLabel.ru}`} loading="lazy" decoding="async" width="1200" height="675" onError={() => setFailedUrl(imageUrl)} />
        : <span className="home-feature-icon" aria-hidden="true"><HomeFeatureIcon feature={feature} /></span>}
    </span>
    <span className="home-feature-copy"><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
  </>;
  return feature.linkUrl
    ? <a className="home-feature-item" href={feature.linkUrl}>{content}</a>
    : <div className="home-feature-item">{content}</div>;
}

function HomeFeatures({ features, lang }) {
  if (!features?.length) return null;
  return (
    <section className="home-features">
      <div className="container home-features-grid">
        {features.map((feature) => <HomeFeatureCard feature={feature} lang={lang} key={feature.id || feature.key} />)}
      </div>
    </section>
  );
}

function HomeVehiclePreview({ vehicles, sections, lang, t, loading }) {
  const labels = homeLabels(lang);
  const selection = selectHomepageVehicles(sections || [], vehicles);
  if (!selection.enabled) return null;
  const preview = selection.vehicles;
  return (
    <section className="home-fleet-section" id="featured-vehicles">
      <div className="container">
        <div className="home-section-heading">
          <div><span className="section-eyebrow">SFHYL.CN</span><h2>{labels.fleetTitle}</h2><p>{labels.fleetCopy}</p></div>
          <a href={withLang('/vehicles', lang)}>{t.browseVehicles}<ArrowRight size={16} /></a>
        </div>
        {loading ? (
          <div className="vehicle-grid vehicle-skeleton-grid" aria-busy="true" aria-label="正在加载车辆">
            {Array.from({ length: 4 }, (_, index) => <VehicleCardSkeleton key={index} />)}
          </div>
        ) : preview.length ? (
          <div className="vehicle-grid home-preview-grid">
            {preview.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} lang={lang} t={t} />)}
          </div>
        ) : (
          <div className="home-fleet-empty"><Car size={24} /><span>{labels.fleetEmpty}</span><a href={withLang('/contact', lang)}>{t.getInTouch}<ArrowRight size={16} /></a></div>
        )}
      </div>
    </section>
  );
}

function HomeFooterSections({ site, brands, lang, t }) {
  const settings = site?.settings || {};
  const contact = settings.contact || {};

  return (
    <>
      {brands.length ? (
        <section className="home-brands">
          <div className="container">
            <div className="home-section-heading"><h2>{t.brandsTitle}</h2><a href={withLang('/vehicles', lang)}>{t.browseVehicles}<ArrowRight size={16} /></a></div>
            <div className="brand-strip">
              {brands.map((brand) => (
                <a key={brand.id} href={withLang(`/vehicles?brand=${encodeURIComponent(brand.nameEn || brand.nameZh)}`, lang)}>
                  {brand.logoUrl ? <img src={brand.logoUrl} alt="" loading="lazy" /> : <span className="brand-logo-placeholder" aria-hidden="true">{(brand.nameEn || brand.nameZh).slice(0, 1)}</span>}
                  <span>{brand[`name${lang[0].toUpperCase()}${lang.slice(1)}`] || brand.nameEn || brand.nameZh}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="home-contact-band">
        <div className="container home-contact-content">
          <div><h2>{t.contactTitle}</h2><p>{contact.phone || contact.whatsapp || t.homeIntroCopy}</p></div>
          <a className="home-light-action" href={withLang('/contact', lang)}>{t.getInTouch}<ArrowRight size={18} /></a>
        </div>
      </section>
    </>
  );
}

export function HomePage({ content, about, site, lang, setLang, t, catalogOnly = false, contentStatus = 'ready', onReloadContent = () => {} }) {
  const homeContent = content || fallbackSiteContent.home;
  const homeVehicles = homeContent.vehicles || fallbackSiteContent.home.vehicles;
  const homeBrands = homeContent.brands || [];
  const yearRanges = useMemo(() => yearRangesForVehicles(homeVehicles), [homeVehicles]);
  const { rates, status: rateStatus } = useExchangeRates(homeContent.rates || fallbackSiteContent.home.rates);
  const [filters, setFilters] = useState(() => filtersFromUrl(homeVehicles, homeBrands));
  const initialUrlFiltersApplied = useRef(homeVehicles.length > 0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!initialUrlFiltersApplied.current && (homeVehicles.length > 0 || contentStatus !== 'loading')) {
      setFilters(filtersFromUrl(homeVehicles, homeBrands));
      initialUrlFiltersApplied.current = true;
    }
  }, [homeVehicles, homeBrands, contentStatus]);

  const filteredVehicles = useMemo(() => {
    const price = pickRange(filters.price, priceRanges);
    const year = pickRange(filters.year, yearRanges);
    const mileage = pickRange(filters.mileage, mileageRanges);
      const query = filters.query.trim().toLowerCase();

      return homeVehicles.filter((vehicle) => {
        const matchesBrand =
        filters.brand === 'select' ||
        filters.brand === 'all' ||
        vehicle.brand === filters.brand;
      const matchesModel = filters.model === 'select' || slugifyModel(vehicleModelLabel(vehicle)) === filters.model;
      const matchesPrice = vehicle.price >= price.min && vehicle.price <= price.max;
      const matchesYear = vehicle.year >= year.min && vehicle.year <= year.max;
      const matchesMileage = vehicle.mileage >= mileage.min && vehicle.mileage <= mileage.max;
      const searchable = [vehicle.id, vehicle.stockNo, vehicle.vin, vehicle.title, vehicle.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = !query || searchable.includes(query);
      return matchesBrand && matchesModel && matchesPrice && matchesYear && matchesMileage && matchesQuery;
    });
  }, [filters, homeVehicles, yearRanges]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (!initialUrlFiltersApplied.current) return;
    const normalizedModel = normalizeModelParam(filters.model, homeVehicles, filters.brand);
    if (filters.model !== 'select' && normalizedModel !== filters.model) {
      setFilters((current) => ({ ...current, model: normalizedModel }));
      return;
    }

    const url = new URL(catalogOnly ? '/vehicles' : '/', window.location.origin);
    url.searchParams.set('lang', currentLangParam(lang));
    if (filters.brand !== 'select') url.searchParams.set('brand', filters.brand);
    if (filters.model !== 'select') url.searchParams.set('model', filters.model);
    if (filters.price !== 'all') url.searchParams.set('price', filters.price);
    if (filters.year !== 'all') url.searchParams.set('year', filters.year);
    if (filters.mileage !== 'all') url.searchParams.set('mileage', filters.mileage);
    if (filters.query.trim()) url.searchParams.set('query', filters.query.trim());
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [catalogOnly, filters, homeVehicles, lang]);

  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const pageVehicles = filteredVehicles.slice((page - 1) * pageSize, page * pageSize);
  const catalogLoading = catalogOnly && contentStatus === 'loading';
  const catalogFailed = catalogOnly && contentStatus === 'fallback';

  return (
    <div id="top" className="app">
      <Header currentPage={catalogOnly ? 'vehicles' : 'home'} site={site} lang={lang} setLang={setLang} t={t} />
      <main>
        {catalogOnly ? (
          <>
            <SearchPanel
              filters={filters}
              setFilters={setFilters}
              vehiclesData={homeVehicles}
              brands={homeBrands}
              rates={rates}
              rateStatus={rateStatus}
              lang={lang}
              t={t}
            />
            <section className="catalog-section">
              <div className="container">
                {catalogLoading ? (
                  <div className="vehicle-grid vehicle-skeleton-grid" aria-busy="true" aria-label="正在加载车辆">
                    {Array.from({ length: 8 }, (_, index) => <VehicleCardSkeleton key={index} />)}
                  </div>
                ) : catalogFailed ? (
                  <div className="empty-state catalog-load-error" role="alert">
                    <Car size={44} />
                    <p>车辆目录加载失败，请稍后重试。</p>
                    <button className="catalog-retry-button" type="button" onClick={onReloadContent}>重新加载</button>
                  </div>
                ) : pageVehicles.length ? (
                  <div className="vehicle-grid">
                    {pageVehicles.map((vehicle) => (
                      <VehicleCard key={vehicle.id} vehicle={vehicle} lang={lang} t={t} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Car size={44} />
                    <p>{t.empty}</p>
                  </div>
                )}
                {contentStatus === 'ready' && pageVehicles.length ? <Pagination page={page} pageCount={pageCount} onPage={setPage} t={t} /> : null}
              </div>
            </section>
          </>
        ) : (
          <>
            <HomeMedia
              slides={homeContent.heroSlides?.length ? homeContent.heroSlides : about?.heroSlides}
              lang={lang}
              t={t}
            />
            <HomeFeatures features={homeContent.features} lang={lang} />
            <CustomModules
              modules={about?.customModules}
              processImage={about?.transportImages?.[0]?.image}
              lang={lang}
              currentPage="home"
              placement="HOME_AFTER_FEATURES"
            />
            <HomeVehiclePreview vehicles={homeVehicles} sections={homeContent.sections} lang={lang} t={t} loading={contentStatus === 'loading'} />
            <HomeFooterSections site={site} brands={homeBrands} lang={lang} t={t} />
          </>
        )}
      </main>
      <RichSiteFooter about={about} site={site} lang={lang} t={t} />
    </div>
  );
}
