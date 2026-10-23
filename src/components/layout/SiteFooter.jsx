export function SiteFooter({ site = {}, t }) {
  const settings = site.settings || {};
  const basic = settings.basic || {};
  const contact = settings.contact || {};
  const footer = settings.footer || {};
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <section>
          <h2>{basic.companyNameEn || t.company}</h2>
          {basic.siteDescription ? <p>{basic.siteDescription}</p> : null}
        </section>
        {contact.phone || contact.email || contact.address ? <section>
          <h2>{t.buyingInfo}</h2>
          <p>{[contact.phone, contact.email].filter(Boolean).join(' · ')}{contact.address ? <><br />{contact.address}</> : null}</p>
        </section> : null}
      </div>
      <div className="copyright">{footer.copyright || `Copyright © ${new Date().getFullYear()} ${basic.siteNameEn || 'SFHYL.CN'}`}{footer.icpNumber ? ` · ${footer.icpNumber}` : ''}</div>
    </footer>
  );
}
