import { useEffect, useState } from 'react';
import { Car } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fallbackSiteContent } from '../services/siteContent.js';
import { Header, currentLangParam, withLang } from '../components/layout/Header.jsx';
import { SiteFooter } from '../components/layout/SiteFooter.jsx';
import { translations } from '../i18n/language.js';
import { optimizedImageUrl } from '../utils/media.js';
import { InquiryDialog } from '../components/inquiry/InquiryDialog.jsx';
import { loadPublicVehicle } from '../services/platformApi.js';
import { formatCurrency, hasDisplayablePrice } from '../utils/currency.js';

const inquiryPriceLabels = { zh: '询价', en: 'Inquire', ru: 'По запросу' };
const soldLabels = { zh: '已售', en: 'Sold', ru: 'Продано' };

const formatMileage = (value, lang = 'ru') => {
  const copy = translations[lang] || translations.ru;
  return `${copy.mileagePrefix} ${Number(value || 0).toLocaleString('en-US')}km`;
};

function catalogUrl({ lang, brand, model } = {}) {
  const url = new URL('/vehicles', window.location.origin);
  url.searchParams.set('lang', currentLangParam(lang));
  if (brand) url.searchParams.set('brand', brand);
  if (model) url.searchParams.set('model', model);
  return `${url.pathname}${url.search}`;
}

function detailUrl(vehicle, lang) {
  return `/vehicle/${encodeURIComponent(vehicle.id)}?lang=${encodeURIComponent(currentLangParam(lang))}`;
}

function localizedField(value, lang, fallback = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[currentLangParam(lang)] || value.ru || value.zh || value.en || fallback;
  }
  return value || fallback;
}

function localizedVehicleTitle(vehicle, lang) {
  return localizedField(vehicle?.titleI18n || vehicle?.titleTranslations, lang, vehicle?.title || '');
}

function localizedVehicleDescription(vehicle, lang) {
  return localizedField(vehicle?.descriptionI18n || vehicle?.descriptionTranslations, lang, vehicle?.description || '');
}

function slugifyModel(value = '') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9\u0400-\u04ff\u4e00-\u9fa5]+/gi, '_').replace(/^_+|_+$/g, '');
}

function vehicleModelLabel(vehicle) {
  return vehicle.model || vehicle.title.split(' ').slice(0, 2).join(' ');
}

function getVehicleGallery(vehicle, allVehicles) {
  if (Array.isArray(vehicle.gallery) && vehicle.gallery.length) return vehicle.gallery;
  const nearby = allVehicles
    .filter((item) => item.id !== vehicle.id)
    .slice(0, 5)
    .map((item) => item.image);
  return [vehicle.image, ...nearby].filter(Boolean);
}

function findVehicleById(allVehicles, id) {
  if (!id) return null;
  return (
    allVehicles.find((vehicle) => String(vehicle.id) === String(id) || String(vehicle.legacyId || '') === String(id)) ||
    (String(id) === '5808' ? allVehicles[0] : null)
  );
}

function detailModelSlug(vehicle) {
  return slugifyModel(vehicleModelLabel(vehicle));
}

function vehicleEngineVolume(vehicle) {
  if (vehicle.volume) return vehicle.volume;
  const match = String(vehicle.engine || '').match(/\d+(?:\.\d+)?/);
  return match ? `${Math.round(Number(match[0]) * 1000)} ml.` : '-';
}

function vehicleDetailRows(vehicle, t) {
  return [
    { key: 'year', className: 'year', label: t.year, value: vehicle.year ? `${vehicle.year}` : '-' },
    { key: 'engine', className: 'engine-type', label: t.engine, value: vehicle.engine || '-' },
    { key: 'transmission', className: 'transmission', label: t.transmission, value: vehicle.transmission || '-' },
    { key: 'color', className: 'color', label: t.color || 'Color', value: vehicle.color || '-' },
    {
      key: 'mileage',
      className: 'mileage',
      label: t.mileage,
      value: `${Number(vehicle.mileage || 0).toLocaleString('en-US')} km.`,
    },
    { key: 'volume', className: 'volume', label: t.volume || 'Volume', value: vehicleEngineVolume(vehicle) },
    { key: 'power', className: 'power-ps', label: t.power || 'Power', value: vehicle.power || '-' },
    { key: 'vin', className: 'vin', label: t.vin || 'VIN', value: vehicle.vin || '****' },
  ];
}

function RecommendationCarCard({ vehicle, lang }) {
  const href = detailUrl(vehicle, lang);
  const title = localizedVehicleTitle(vehicle, lang);

  return (
    <div className="car-card">
      <a href={href} className="shoutu" aria-label={title}>
        <img src={optimizedImageUrl(vehicle.image)} className="car-img" alt={title} loading="lazy" />
      </a>
      <div className="car-card-body">
        <h5 className="car-title">{title}</h5>
        <p className="car-price">
          {hasDisplayablePrice(vehicle.price) ? formatCurrency(vehicle.price, vehicle.currency) : inquiryPriceLabels[lang] || inquiryPriceLabels.ru}
          <small>{vehicle.rub}</small>
        </p>
        <a href={href} className="car-more-btn">
          {vehicle.brand}
        </a>
      </div>
    </div>
  );
}

export function VehicleDetailPage({ content, site, lang, setLang, t }) {
  const homeContent = content || fallbackSiteContent.home;
  const allVehicles = homeContent.vehicles || fallbackSiteContent.home.vehicles;
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const requestedId = routeParams.id || searchParams.get('id');
  const listVehicle = findVehicleById(allVehicles, requestedId);
  const [remoteVehicle, setRemoteVehicle] = useState(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const vehicle = remoteVehicle || listVehicle;
  const [activeImage, setActiveImage] = useState(listVehicle?.image || '');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setRemoteVehicle(null);
    const detailKey = listVehicle?.slug || requestedId;
    if (!detailKey) return undefined;
    loadPublicVehicle(detailKey, { signal: controller.signal })
      .then((result) => { if (!cancelled) setRemoteVehicle(result); })
      .catch(() => {});
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [listVehicle?.slug, requestedId]);

  useEffect(() => {
    setActiveImage(vehicle?.image || '');
  }, [vehicle?.id, vehicle?.image]);

  if (!vehicle) {
    return (
      <div className="app">
        <Header currentPage="vehicles" site={site} lang={lang} setLang={setLang} t={t} />
        <main id="main-content" tabIndex={-1} className="detail-section">
          <div className="container empty-state">
            <Car size={44} />
            <p>{t.notFound}</p>
            <a href="/">{t.detailBack}</a>
          </div>
        </main>
      </div>
    );
  }

  const gallery = getVehicleGallery(vehicle, allVehicles);
  const activeIndex = Math.max(0, gallery.findIndex((image) => image === activeImage));
  const activeGalleryImage = gallery[activeIndex] || vehicle.image;
  const recommended = allVehicles.filter((item) => item.id !== vehicle.id).slice(0, 5);
  const detailRows = vehicleDetailRows(vehicle, t);
  const modelCrumb = detailModelSlug(vehicle);
  const vehicleTitle = localizedVehicleTitle(vehicle, lang);
  const modelCrumbLabel = vehicle.model || vehicleTitle;
  const vehicleDescription = localizedVehicleDescription(vehicle, lang);
  const showPreviousImage = () => {
    const nextIndex = activeIndex <= 0 ? gallery.length - 1 : activeIndex - 1;
    setActiveImage(gallery[nextIndex] || vehicle.image);
  };
  const showNextImage = () => {
    const nextIndex = activeIndex >= gallery.length - 1 ? 0 : activeIndex + 1;
    setActiveImage(gallery[nextIndex] || vehicle.image);
  };

  return (
    <div className="app detail-page">
      <Header currentPage="vehicles" site={site} lang={lang} setLang={setLang} t={t} />
      <main id="main-content" tabIndex={-1} className="detail-section">
        <div className="container">
          <nav aria-label="breadcrumb" className="detail-breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href={catalogUrl({ lang })}>{t.home}</a>
              </li>
              <li className="breadcrumb-item">
                <a href={catalogUrl({ lang, brand: vehicle.brand })}>{vehicle.brand}</a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                <a href={catalogUrl({ lang, brand: vehicle.brand, model: modelCrumb })}>{modelCrumbLabel}</a>
              </li>
            </ol>
          </nav>

          <div className="row g-2 detail-title-row">
            <div className="col-lg-11">
              <h1 className="detail-title">{vehicleTitle}</h1>
              {vehicle.saleStatus === 'SOLD' ? <span className="detail-sold-status">{soldLabels[lang] || soldLabels.ru}</span> : null}
            </div>
            <div className="col-lg-1">
              <div className="sharethis-inline-share-buttons" aria-hidden="true" />
            </div>
          </div>

          <section className="row g-4 detail-main">
            <div className="col-lg-7">
              <div className="detail-gallery">
                <div className="main-image position-relative">
                  <img
                    id="mainCarImage"
                    src={optimizedImageUrl(activeGalleryImage)}
                    className="img-fluid w-10 h-100"
                    alt={vehicleTitle}
                  />
                  <button
                    type="button"
                    id="prevBtn"
                    className="carousel-control-prev"
                    aria-label={t.previous}
                    onClick={showPreviousImage}
                  >
                    <span className="carousel-control-prev-icon" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    id="nextBtn"
                    className="carousel-control-next"
                    aria-label={t.next}
                    onClick={showNextImage}
                  >
                    <span className="carousel-control-next-icon" aria-hidden="true" />
                  </button>
                </div>
                <div className="thumbnail-list mt-3">
                  {gallery.map((image) => (
                    <button
                      key={image}
                      type="button"
                      className="thumbnail-button"
                      aria-label={vehicleTitle}
                      onClick={() => setActiveImage(image)}
                    >
                      <img
                        src={optimizedImageUrl(image)}
                        className={image === activeGalleryImage ? 'thumbnail active' : 'thumbnail'}
                        alt=""
                        data-src={image}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <aside className="detail-info-card">
                <div className="price-section">
                  <div className="price-item">
                    <div className="price-item-left">
                      <span className="price-label">{t.detailPrice}</span>
                      <span className="price-jpy">{hasDisplayablePrice(vehicle.price) ? formatCurrency(vehicle.price, vehicle.currency) : inquiryPriceLabels[lang] || inquiryPriceLabels.ru}</span>
                    </div>
                    <div className="price-value">
                      <span className="price-rub">~ {vehicle.rub}</span>
                      <span
                        className="price-info-icon"
                        title="Actual transaction price is calculated using the exchange rate at signing."
                      >
                        i
                      </span>
                    </div>
                  </div>
                </div>

                <div className="canshu">
                  {detailRows.map((row) => (
                    <p key={row.key}>
                      <span className={row.className}>{row.label}</span>
                      <span className="param-value">{row.value}</span>
                    </p>
                  ))}
                  <p className="mt-3 contact-row">
                    <button className="btn w-100 py-2 detail-contact-button" type="button" onClick={() => setInquiryOpen(true)}>
                      {t.detailContact}
                    </button>
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <div className="detail-extra">
            <h3 className="extra-title">{t.detailDescription}</h3>
            <div className="vehicle-description" dangerouslySetInnerHTML={{ __html: vehicleDescription || `${vehicleTitle}. ${t.detailPrice}: ${formatCurrency(vehicle.price, vehicle.currency)}. ${formatMileage(vehicle.mileage, lang)}.` }} />
          </div>
        </div>
      </main>

      <section className="hot-cars-section detail-recommended">
        <div className="container">
          <h2 className="brand-title">{t.recommended}</h2>
          {!recommended.length ? <p className="detail-empty">{lang === 'zh' ? '暂无更多推荐车辆。' : lang === 'en' ? 'No further recommendations at the moment.' : 'Других рекомендаций пока нет.'}<br /><a href={catalogUrl({ lang })}>{t.browseVehicles}</a></p> : null}
          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4">
            {recommended.map((item) => (
              <div className="col" key={item.id}>
                <RecommendationCarCard vehicle={item} lang={lang} />
              </div>
            ))}
          </div>
        </div>
      </section>
      {inquiryOpen ? <InquiryDialog title={t.detailContact} vehicleTitle={vehicleTitle} lang={lang} vehicle={vehicle} onClose={() => setInquiryOpen(false)} /> : null}
      <SiteFooter site={site} t={t} />
    </div>
  );
}
