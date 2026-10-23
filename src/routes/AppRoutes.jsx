import { Navigate, Route, Routes } from 'react-router-dom';
import { AboutPage } from '../pages/AboutPage.jsx';
import { withLang } from '../components/layout/Header.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { VehicleDetailPage } from '../pages/VehicleDetailPage.jsx';
import { ContactPage } from '../pages/ContactPage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { AccountPage } from '../pages/AccountPage.jsx';

export function AppRoutes({ content, vehicleStatus, reload, lang, setLang, t }) {
  return (
    <Routes>
      <Route path="/admin" element={<AdminRedirect />} />
      <Route path="/aboutus.html" element={<Navigate replace to={withLang('/about', lang)} />} />
      <Route path="/about" element={<AboutPage content={content.about} site={content.site} lang={lang} setLang={setLang} t={t} currentPage="about" />} />
      <Route path="/contact" element={<ContactPage about={content.about} site={content.site} lang={lang} setLang={setLang} t={t} />} />
      <Route path="/login" element={<LoginPage site={content.site} lang={lang} setLang={setLang} t={t} />} />
      <Route path="/account" element={<AccountPage site={content.site} lang={lang} setLang={setLang} t={t} />} />
      <Route path="/vehicles" element={<HomePage content={content.home} about={content.about} site={content.site} lang={lang} setLang={setLang} t={t} catalogOnly contentStatus={vehicleStatus} onReloadContent={reload} />} />
      <Route path="/index.php" element={<VehicleDetailPage content={content.home} site={content.site} lang={lang} setLang={setLang} t={t} />} />
      <Route path="/vehicle/:id" element={<VehicleDetailPage content={content.home} site={content.site} lang={lang} setLang={setLang} t={t} />} />
      <Route path="/" element={<HomePage content={content.home} about={content.about} site={content.site} lang={lang} setLang={setLang} t={t} contentStatus={vehicleStatus} />} />
      <Route path="*" element={<Navigate replace to={withLang('/', lang)} />} />
    </Routes>
  );
}

function AdminRedirect() {
  const adminUrl = (import.meta.env.VITE_ADMIN_URL || '/admin').replace(/\/$/, '');
  window.location.replace(`${adminUrl}/`);
  return null;
}
