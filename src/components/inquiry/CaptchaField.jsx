import { useEffect, useRef, useState } from 'react';

const providers = {
  turnstile: {
    script: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    render: (element, sitekey, onToken, onError) => window.turnstile.render(element, {
      sitekey,
      callback: onToken,
      'expired-callback': () => onToken(''),
      'error-callback': onError,
    }),
    reset: (id) => window.turnstile.reset(id),
    remove: (id) => window.turnstile.remove(id),
  },
  hcaptcha: {
    script: 'https://js.hcaptcha.com/1/api.js?render=explicit',
    render: (element, sitekey, onToken, onError) => window.hcaptcha.render(element, {
      sitekey,
      callback: onToken,
      'expired-callback': () => onToken(''),
      'error-callback': onError,
    }),
    reset: (id) => window.hcaptcha.reset(id),
    remove: (id) => window.hcaptcha.remove(id),
  },
};

const scripts = new Map();

function loadScript(provider) {
  if (scripts.has(provider)) return scripts.get(provider);
  const promise = new Promise((resolve, reject) => {
    const id = `sfhyl-captcha-${provider}`;
    const existing = document.getElementById(id);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = providers[provider].script;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  scripts.set(provider, promise);
  return promise;
}

export function CaptchaField({ provider, siteKey, onToken, onError, resetNonce }) {
  const container = useRef(null);
  const widgetId = useRef(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!providers[provider] || !siteKey) {
      setLoadError(true);
      onToken('');
      return undefined;
    }
    loadScript(provider)
      .then(() => {
        if (!active || !container.current) return;
        widgetId.current = providers[provider].render(
          container.current,
          siteKey,
          onToken,
          () => {
            onToken('');
            onError?.();
          },
        );
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
        onToken('');
        onError?.();
      });
    return () => {
      active = false;
      if (widgetId.current !== null) providers[provider].remove(widgetId.current);
    };
  }, [provider, siteKey, onError, onToken]);

  useEffect(() => {
    if (widgetId.current !== null) providers[provider].reset(widgetId.current);
  }, [provider, resetNonce]);

  if (loadError) return <p className="inquiry-error">Captcha is temporarily unavailable.</p>;
  return <div className="inquiry-captcha" ref={container} />;
}
