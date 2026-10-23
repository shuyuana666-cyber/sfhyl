import { useEffect, useRef, useState } from "react";
import { Building2, CarFront, Home, LogIn, Menu, Users, X } from "lucide-react";
import {
  languageLabels,
  supportedLanguages,
  translations,
} from "../../i18n/language.js";

function currentLangParam(lang) {
  return supportedLanguages.includes(lang) ? lang : "ru";
}
function withLang(path, lang) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("lang", currentLangParam(lang));
  return `${url.pathname}${url.search}${url.hash}`;
}

function Header({
  currentPage = "home",
  site = {},
  lang = "ru",
  setLang = () => {},
  t = translations.ru,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuRef.current?.focus();
      }
    };
    document.addEventListener("keydown", dismiss);
    const dismissOutside = (event) => {
      if (
        !navRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", dismissOutside);
    };
  }, [open]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1101px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const coreItems = [
    { label: t.home, icon: Home, href: withLang("/", lang), key: "home" },
    {
      label: t.vehicles,
      icon: CarFront,
      href: withLang("/vehicles", lang),
      key: "vehicles",
    },
    {
      label: t.aboutTitle,
      icon: Building2,
      href: withLang("/about", lang),
      key: "about",
    },
    {
      label: t.getInTouch,
      icon: Users,
      href: withLang("/contact", lang),
      key: "contact",
    },
  ];
  const apiItems = (Array.isArray(site.navigation) ? site.navigation : [])
    .filter((item) => item?.key && typeof item.href === "string" && item.href)
    .map((item) => ({
      label:
        item[`label${lang === "zh" ? "Zh" : lang === "en" ? "En" : "Ru"}`] ||
        item.labelEn ||
        item.labelZh,
      icon:
        item.key === "home" ? Home : item.key === "vehicles" ? CarFront : Users,
      href: item.href.startsWith("/") ? withLang(item.href, lang) : item.href,
      key: item.key,
      external: item.target === "NEW_TAB",
    }))
    .filter(
      (item) =>
        item.key !== "tracking" && item.key !== "login" && item.key !== "about",
    );
  const items = [
    ...coreItems.map(
      (coreItem) =>
        apiItems.find((item) => item.key === coreItem.key) || coreItem,
    ),
    ...apiItems.filter(
      (item) => !coreItems.some((coreItem) => coreItem.key === item.key),
    ),
  ];
  const loginItem = {
    label:
      lang === "zh"
        ? "\u767b\u5f55"
        : lang === "en"
          ? "Login"
          : "\u0412\u043e\u0439\u0442\u0438",
    href: withLang("/login", lang),
  };
  const settings = site.settings || {};
  const brandName =
    settings.basic?.shortName || settings.basic?.siteNameEn || "SFHYL.CN";
  const logoUrl = settings.branding?.logoUrl || "/brand-logo.jpg";
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        {lang === "zh"
          ? "跳转到内容"
          : lang === "en"
            ? "Skip to content"
            : "Перейти к содержимому"}
      </a>
      <div className="container nav-shell">
        <a
          className="brand"
          href={withLang("/", lang)}
          aria-label={`${brandName} home`}
        >
          {logoUrl && <img src={logoUrl} alt="" />}
          <span>{brandName}</span>
        </a>
        <button
          ref={menuRef}
          className="icon-button menu-button"
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="site-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav
          ref={navRef}
          id="site-navigation"
          aria-label={lang === "zh" ? "主导航" : "Main navigation"}
          className={open ? "nav-links open" : "nav-links"}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={item.key === currentPage ? "page" : undefined}
                className={
                  item.key === currentPage ? "nav-link active" : "nav-link"
                }
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
              >
                <Icon size={19} strokeWidth={1.8} />
                {item.label}
              </a>
            );
          })}
          <span className="language-switch" aria-label="Language switch">
            {supportedLanguages.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={item === lang}
                className={item === lang ? "active" : ""}
                onClick={() => {
                  setLang(item);
                  setOpen(false);
                }}
              >
                {languageLabels[item]}
              </button>
            ))}
          </span>
          <a
            href={loginItem.href}
            className={
              currentPage === "login"
                ? "nav-link nav-login active"
                : "nav-link nav-login"
            }
          >
            <LogIn size={19} strokeWidth={1.8} />
            {loginItem.label}
          </a>
        </nav>
      </div>
    </header>
  );
}

export { Header, withLang, currentLangParam };
