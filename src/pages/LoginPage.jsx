import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header.jsx';
import {
  registerCustomer,
  saveCustomerSession,
  unifiedLogin,
} from '../services/customerAuth.js';

const INITIAL_FORM = {
  identifier: '',
  password: '',
  name: '',
  companyName: '',
  phone: '',
  email: '',
};

export function LoginPage({ site, lang, setLang, t }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function updateField(field) {
    return (event) => {
      const { value } = event.target;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (mode === 'register') {
        const tokens = await registerCustomer(form);
        saveCustomerSession(tokens);
        navigate('/account');
        return;
      }

      const result = await unifiedLogin({
        identifier: form.identifier,
        password: form.password,
        remember: true,
      });

      if (result.accountType === 'admin') {
        const adminUrl = (import.meta.env.VITE_ADMIN_URL || '/admin')
          .replace(/\/$/, '');
        const accessToken = encodeURIComponent(result.tokens.accessToken);
        const refreshToken = encodeURIComponent(result.tokens.refreshToken);
        window.location.assign(
          `${adminUrl}/#accessToken=${accessToken}&refreshToken=${refreshToken}`,
        );
        return;
      }

      saveCustomerSession(result.tokens);
      navigate('/account');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '操作失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <Header currentPage="login" site={site} lang={lang} setLang={setLang} t={t} />
      <main id="main-content" tabIndex={-1} className="account-shell">
        <form className="account-panel" onSubmit={submit} aria-busy={busy}>
          <div>
            <h1>{mode === 'login' ? '欢迎回来' : '创建账户'}</h1>
            <p className="account-description">{mode === 'login' ? '登录后管理个人资料并查看询盘进度。' : '填写联系信息，方便我们跟进您的车辆需求。'}</p>
          </div>
          <div className="account-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              aria-pressed={mode === 'login'}
              disabled={busy}
              onClick={() => setMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              aria-pressed={mode === 'register'}
              disabled={busy}
              onClick={() => setMode('register')}
            >
              注册
            </button>
          </div>

          {mode === 'register' ? (
            <>
              <label>
                姓名
                <input required autoComplete="name" value={form.name} onChange={updateField('name')} />
              </label>
              <label>
                公司名称
                <input autoComplete="organization" value={form.companyName} onChange={updateField('companyName')} />
              </label>
              <label>
                手机号码
                <input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={updateField('phone')} />
              </label>
              <label>
                邮箱
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={updateField('email')}
                />
              </label>
            </>
          ) : (
            <label>
              手机号、邮箱或管理员账号
              <input
                required
                autoComplete="username"
                value={form.identifier}
                onChange={updateField('identifier')}
              />
            </label>
          )}

          <label>
            密码
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={updateField('password')}
            />
          </label>

          {error ? <p className="account-error" role="alert">{error}</p> : null}
          <button className="account-submit" disabled={busy}>
            {busy ? '处理中...' : mode === 'login' ? '登录' : '创建账户'}
          </button>
        </form>
      </main>
    </div>
  );
}
