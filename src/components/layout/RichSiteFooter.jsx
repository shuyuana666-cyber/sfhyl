import { MapPin } from "lucide-react";
import { currentLangParam, withLang } from "./Header.jsx";

function localizedField(value, lang, fallback = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return (
      value[currentLangParam(lang)] ||
      value.zh ||
      value.en ||
      value.ru ||
      fallback
    );
  }
  return value || fallback;
}

function footerLink(href, lang, onAboutPage) {
  if (!href) return "";
  if (href.startsWith("#")) {
    return onAboutPage ? href : `${withLang("/about", lang)}${href}`;
  }
  return href.startsWith("/") && !href.startsWith("//")
    ? withLang(href, lang)
    : href;
}

export function RichSiteFooter({ about, site, lang, t, onAboutPage = false }) {
  const content = about || {};
  const managed = content.managed === true;
  const showQuickNav = !managed || content.sectionEnabled?.quickNav !== false;
  const showLocations = !managed || content.sectionEnabled?.locations !== false;
  const addresses = showLocations ? content.footerAddresses || [] : [];
  const items = addresses.map((address) => {
    if (address && typeof address === "object" && address.addressI18n) {
      return { ...address, text: localizedField(address.addressI18n, lang) };
    }
    return { text: localizedField(address, lang) };
  });
  const quickNav = showQuickNav ? content.quickNav : null;
  const links = quickNav?.items?.length
    ? quickNav.items
        .filter((item) => item.enabled !== false)
        .map((item) => ({
          href: item.href,
          label: localizedField(item.label, lang, ""),
        }))
    : !managed && showQuickNav
      ? [
          { href: "#about", label: t.aboutTitle },
          { href: "#fahuo", label: t.transportTitle },
          { href: "#yuangong", label: t.staffTitle },
          { href: "#shipin", label: t.videoTitle },
        ]
      : [];

  return (
    <footer id="footer" className="about-footer">
      <div className="about-container about-footer-grid">
        {links.length ? (
          <section className="about-footer-nav">
            <h3>{localizedField(quickNav?.title, lang, t.quickNav)}</h3>
            {links.map((item) => (
              <a
                key={`${item.href}-${item.label}`}
                href={footerLink(item.href, lang, onAboutPage)}
              >
                {item.label}
              </a>
            ))}
          </section>
        ) : null}
        {items.length ? (
          <section className="about-footer-addresses">
            <h3>
              {localizedField(content.locationsTitleI18n, lang, t.officesTitle)}
            </h3>
            <ul>
              {items.map((address, index) => (
                <li key={`${address.text}-${index}`}>
                  <MapPin size={16} strokeWidth={1.8} aria-hidden="true" />
                  {address.mapUrl ? (
                    <a href={address.mapUrl} target="_blank" rel="noreferrer">
                      {address.text}
                    </a>
                  ) : (
                    <span>{address.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div className="about-footer-copy">
        {site?.settings?.footer?.copyright ||
          `Copyright © ${new Date().getFullYear()} ${site?.settings?.basic?.shortName || site?.settings?.basic?.siteNameEn || "SFHYL.CN"}`}
      </div>
    </footer>
  );
}
