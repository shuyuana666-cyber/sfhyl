import { InquiryForm } from '../components/inquiry/InquiryForm.jsx';
import { ContactSocialLinks } from '../components/content/ContactSocialLinks.jsx';
import { Header } from '../components/layout/Header.jsx';
import { RichSiteFooter } from '../components/layout/RichSiteFooter.jsx';

const titles = {
  zh: ['联系我们', '告诉我们您需要的车辆和交付地区。'],
  en: ['Contact us', 'Tell us which vehicle you need and where it should be delivered.'],
  ru: ['Свяжитесь с нами', 'Сообщите, какой автомобиль вам нужен и куда его доставить.'],
};

export function ContactPage({ about, site, lang, setLang, t }) {
  const [title, subtitle] = titles[lang] || titles.ru;
  const contact = site?.settings?.contact || {};
  return <div className="app contact-page"><Header currentPage="contact" site={site} lang={lang} setLang={setLang} t={t} /><main id="main-content" tabIndex={-1} className="contact-main"><div className="container contact-layout"><div className="contact-intro"><h1>{title}</h1><p>{subtitle}</p><div className="contact-details">{contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.address && <span>{contact.address}</span>}</div><ContactSocialLinks settings={site?.settings} lang={lang} /></div><div className="contact-form-panel"><InquiryForm lang={lang} /></div></div></main><RichSiteFooter about={about} site={site} lang={lang} t={t} /></div>;
}
