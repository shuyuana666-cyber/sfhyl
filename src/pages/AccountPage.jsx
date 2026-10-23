import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header.jsx';
import {
  clearCustomerSession,
  customerInquiries,
  customerLogout,
  customerMe,
  customerSession,
  updateCustomer,
} from '../services/customerAuth.js';

export function AccountPage({ site, lang, setLang, t }) {
  const [profile, setProfile] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    const controller = new AbortController();
    const session = customerSession();

    if (!session?.accessToken) {
      navigate('/login', { replace: true });
      return () => controller.abort();
    }

    Promise.all([
      customerMe({ signal: controller.signal }),
      customerInquiries({ signal: controller.signal }),
    ])
      .then(([customer, customerInquiryList]) => {
        setProfile(customer);
        setInquiries(customerInquiryList);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        if (error?.status === 401) {
          clearCustomerSession();
          navigate('/login', { replace: true });
          return;
        }

        setLoadError(error instanceof Error ? error.message : '账户信息加载失败，请稍后重试。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [navigate, reloadNonce]);

  async function saveProfile(event) {
    event.preventDefault();
    if (!profile || saveStatus === 'saving') return;

    setSaveStatus('saving');
    setSaveError('');
    try {
      setProfile(await updateCustomer(profile));
      setSaveStatus('saved');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '资料保存失败，请稍后重试。');
      setSaveStatus('idle');
    }
  }

  async function logout() {
    setLogoutBusy(true);
    try {
      await customerLogout();
    } catch {
      // Clear the local session even when the server is temporarily unavailable.
    } finally {
      clearCustomerSession();
      navigate('/', { replace: true });
    }
  }

  function updateProfileField(field) {
    return (event) => {
      const { value } = event.target;
      setProfile((current) => ({ ...current, [field]: value }));
      setSaveStatus('idle');
    };
  }

  return (
    <div className="app">
      <Header currentPage="account" site={site} lang={lang} setLang={setLang} t={t} />
      <main id="main-content" tabIndex={-1} className="account-shell">
        <section className="account-panel" aria-busy={loading}>
          {loading ? <div className="account-loading" role="status" aria-label="正在加载账户信息"><span className="account-skeleton" /><span className="account-skeleton" /><span className="account-skeleton" /><span className="account-skeleton" /></div> : null}
          {loadError ? <div role="alert"><p className="account-error">{loadError}</p><button className="account-retry" type="button" onClick={() => setReloadNonce((current) => current + 1)}>重新加载</button></div> : null}

          {profile ? (
            <>
              <div className="account-heading">
                <h1>我的账户</h1>
                <button type="button" disabled={logoutBusy} onClick={logout}>
                  {logoutBusy ? '正在退出...' : '退出登录'}
                </button>
              </div>

              <form onSubmit={saveProfile}>
                <label>
                  姓名
                  <input
                    value={profile.name || ''}
                    onChange={updateProfileField('name')}
                  />
                </label>
                <label>
                  公司名称
                  <input
                    value={profile.companyName || ''}
                    onChange={updateProfileField('companyName')}
                  />
                </label>
                <label>
                  手机号码
                  <input
                    value={profile.phone || ''}
                    onChange={updateProfileField('phone')}
                  />
                </label>
                <label>
                  邮箱
                  <input
                    type="email"
                    value={profile.email || ''}
                    onChange={updateProfileField('email')}
                  />
                </label>
                {saveError ? <p className="account-error" role="alert">{saveError}</p> : null}
                {saveStatus === 'saved' ? <p role="status">资料已保存。</p> : null}
                <button className="account-submit" disabled={saveStatus === 'saving'}>
                  {saveStatus === 'saving' ? '保存中...' : '保存资料'}
                </button>
              </form>

              <h2>我的询盘</h2>
              {inquiries.length ? (
                <ul className="account-inquiries">
                  {inquiries.map((inquiry) => (
                    <li key={inquiry.id}>
                      <strong>
                        #{inquiry.id} {inquiry.vehicle?.nameEn || inquiry.vehicle?.nameZh || '咨询'}
                      </strong>
                      <span>
                        {inquiry.status} · {new Date(inquiry.createdAt).toLocaleDateString()}
                      </span>
                      <p>{inquiry.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="account-empty">暂无询盘记录。</p>
              )}
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
