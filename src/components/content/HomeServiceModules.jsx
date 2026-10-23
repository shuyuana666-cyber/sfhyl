import { useEffect, useId, useState } from 'react';
import { ArrowRight, CheckCircle2, MapPin } from 'lucide-react';
import { withLang } from '../layout/Header.jsx';
import { optimizedImageUrl } from '../../utils/media.js';

const copy = {
  zh: { stage: '服务阶段', progress: '当前查看', region: '目的地', contact: '联系我们', detail: '服务要点', processImage: '车辆出口与运输服务实景' },
  en: { stage: 'Service stage', progress: 'Viewing step', region: 'Destination', contact: 'Contact us', detail: 'What we coordinate', processImage: 'Vehicle export and transport services' },
  ru: { stage: 'Этап работы', progress: 'Выбран этап', region: 'Направление', contact: 'Связаться с нами', detail: 'Что мы координируем', processImage: 'Экспорт и перевозка автомобилей' },
};

function directChild(element, tagName) {
  return Array.from(element.children).find((child) => child.tagName === tagName);
}

function parseEntries(list) {
  if (!list) return null;
  const entries = Array.from(list.children).filter((child) => child.tagName === 'LI').map((item) => {
    const title = directChild(item, 'STRONG')?.textContent?.trim();
    const summary = directChild(item, 'P')?.textContent?.trim();
    const details = Array.from(directChild(item, 'UL')?.children || [])
      .filter((child) => child.tagName === 'LI')
      .map((child) => child.textContent.trim())
      .filter(Boolean);
    return title && summary && details.length ? { title, summary, details } : null;
  });
  return entries.length >= 2 && entries.every(Boolean) ? entries : null;
}

export function parseServiceModule(bodyHtml, moduleId) {
  if (typeof bodyHtml !== 'string' || typeof DOMParser === 'undefined') return null;
  const document = new DOMParser().parseFromString(bodyHtml, 'text/html');
  if (moduleId === 'home-service-process') {
    const list = Array.from(document.body.children).find((child) => child.tagName === 'OL');
    const entries = parseEntries(list);
    return entries ? { entries } : null;
  }
  if (moduleId === 'home-service-regions') {
    const intro = Array.from(document.body.children).find((child) => child.tagName === 'P')?.textContent?.trim();
    const list = Array.from(document.body.children).find((child) => child.tagName === 'UL');
    const entries = parseEntries(list);
    return intro && entries ? { intro, entries } : null;
  }
  return null;
}

function ServiceDetail({ item, index, total, labels, kind }) {
  return (
    <div className="service-detail-panel" key={`${kind}-${index}`}>
      <div className="service-detail-copy">
        <span className="service-detail-eyebrow">{kind === 'process' ? `${labels.progress} ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : labels.region}</span>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
      </div>
      <div className="service-detail-points">
        <strong>{labels.detail}</strong>
        <ul>{item.details.map((detail) => <li key={detail}><CheckCircle2 size={18} aria-hidden="true" />{detail}</li>)}</ul>
      </div>
    </div>
  );
}

export function HomeServiceProcess({ module, title, entries, lang, contentKey, image }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState([]);
  const imageUrl = [module.stageImages?.[activeIndex], image].map(optimizedImageUrl).find(url => url && !failedImages.includes(url));
  const hasImage = Boolean(imageUrl);
  const panelId = useId();
  const labels = copy[lang] || copy.ru;
  useEffect(() => setActiveIndex(0), [contentKey, lang]);
  const selected = entries[activeIndex] || entries[0];

  return (
    <section id={`custom-${module.id}`} className="custom-content-section custom-content-section--home custom-content-module--home-service-process service-module service-process">
      <div className="container">
        <div className="service-module-heading"><span>{labels.stage}</span><h2>{title}</h2></div>
        <div className="service-process-steps" aria-label={title}>
          {entries.map((step, index) => (
            <button
              key={`${index}-${step.title}`}
              type="button"
              className={`service-step${index === activeIndex ? ' is-active' : ''}`}
              aria-pressed={index === activeIndex}
              aria-controls={panelId}
              onClick={() => setActiveIndex(index)}
            >
              <span className="service-step-number">{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.title}</strong>
              <span className="service-step-summary">{step.summary}</span>
            </button>
          ))}
        </div>
        <div className="service-progress-track" aria-hidden="true"><span style={{ width: `${((activeIndex + 1) / entries.length) * 100}%` }} /></div>
        <div className={`service-detail-container${hasImage ? ' service-detail-container--with-media' : ''}`}>
          <div id={panelId} aria-live="polite">
            <ServiceDetail item={selected} index={activeIndex} total={entries.length} labels={labels} kind="process" />
          </div>
          {hasImage ? <figure className="service-process-media">
            <img key={imageUrl} src={imageUrl} alt={module.stageImages?.[activeIndex] ? `${selected.title} · ${{ zh: '服务场景示意', en: 'Illustrative service scene', ru: 'Иллюстрация обслуживания' }[lang] || 'Illustrative service scene'}` : labels.processImage} loading="lazy" decoding="async" onError={() => setFailedImages(previous => [...previous, imageUrl])} />
          </figure> : null}
        </div>
      </div>
    </section>
  );
}

export function HomeServiceRegions({ module, title, intro, entries, lang, buttonLabel, href, contentKey }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const panelId = useId();
  const labels = copy[lang] || copy.ru;
  useEffect(() => setActiveIndex(0), [contentKey, lang]);
  const selected = entries[activeIndex] || entries[0];
  const contactHref = href || withLang('/contact', lang);
  const external = /^https?:\/\//i.test(contactHref);

  return (
    <section id={`custom-${module.id}`} className="custom-content-section custom-content-section--home custom-content-module--home-service-regions service-module service-regions">
      <div className="container">
        <div className="service-module-heading"><span>{labels.region}</span><h2>{title}</h2><p>{intro}</p></div>
        <div className="service-regions-layout">
          <div className="service-country-list" aria-label={title}>
            {entries.map((region, index) => (
              <button
                key={`${index}-${region.title}`}
                type="button"
                className={`service-country${index === activeIndex ? ' is-active' : ''}`}
                aria-pressed={index === activeIndex}
                aria-controls={panelId}
                onClick={() => setActiveIndex(index)}
              >
                <MapPin size={18} aria-hidden="true" /><span>{region.title}</span><ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div id={panelId} className="service-region-detail" aria-live="polite">
            <ServiceDetail item={selected} index={activeIndex} total={entries.length} labels={labels} kind="region" />
            <a className="service-region-contact" href={contactHref} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
              {buttonLabel || labels.contact}<ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
