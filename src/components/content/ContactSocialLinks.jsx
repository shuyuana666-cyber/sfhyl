const copy = {
  zh: { heading: '社交平台', unavailable: '暂无链接' },
  en: { heading: 'Social channels', unavailable: 'Link pending' },
  ru: { heading: 'Социальные сети', unavailable: 'Ссылка не указана' },
};

function externalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function whatsappUrl(socialUrl, phone) {
  const configured = externalUrl(socialUrl);
  if (configured) return configured;
  const digits = String(phone || '').replace(/\D/g, '');
  return /^\d{7,15}$/.test(digits) ? `https://wa.me/${digits}` : '';
}

function SocialIcon({ kind }) {
  if (kind === 'whatsapp') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20.5 11.6a8.5 8.5 0 0 1-12.7 7.5L3 20.7l1.6-4.8a8.5 8.5 0 1 1 15.9-4.3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M8.1 7.8c-.5.3-.8.9-.8 1.5 0 2.8 3.3 6.1 6.1 6.5.8.1 1.5-.2 2-.8l.5-.7-2.3-1.1-.9 1c-1.3-.5-2.5-1.7-3-3l1-.9-1.2-2.3-.7-.2Z" fill="currentColor" />
  </svg>;
  if (kind === 'tiktok') return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M16 2.5c.3 2.2 1.6 3.7 4 4.1v3.3a9 9 0 0 1-4-1.3v5.5a6 6 0 1 1-6-6v3.4a2.6 2.6 0 1 0 2.6 2.6V2.5H16Z" />
  </svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M14.9 21v-8h2.8l.5-3.4h-3.3V7.4c0-1 .3-1.7 1.7-1.7h1.8V2.6c-.3 0-1.4-.1-2.7-.1-2.8 0-4.7 1.7-4.7 4.9v2.2H8V13h3V21h3.9Z" />
  </svg>;
}

export function ContactSocialLinks({ settings, lang }) {
  const labels = copy[lang] || copy.ru;
  const social = settings?.social || {};
  const contact = settings?.contact || {};
  const platforms = [
    { kind: 'whatsapp', name: 'WhatsApp', href: whatsappUrl(social.whatsapp, contact.whatsapp) },
    { kind: 'tiktok', name: 'TikTok', href: externalUrl(social.tiktok) },
    { kind: 'facebook', name: 'Facebook', href: externalUrl(social.facebook) },
  ];

  return <section className="contact-social" aria-label={labels.heading}>
    <h2>{labels.heading}</h2>
    <div className="contact-social-list">
      {platforms.map(({ kind, name, href }) => {
        const contents = <><SocialIcon kind={kind} /><strong>{name}</strong>{!href && <small>{labels.unavailable}</small>}</>;
        return href
          ? <a key={kind} className={`contact-social-link contact-social-link--${kind}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={name}>{contents}</a>
          : <span key={kind} className={`contact-social-link contact-social-link--${kind} is-unavailable`}>{contents}</span>;
      })}
    </div>
  </section>;
}
