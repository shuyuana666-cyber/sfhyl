import { useEffect, useState } from 'react';

function useExchangeRates(fallbackRates) {
  const [rates, setRates] = useState(fallbackRates);
  const [status, setStatus] = useState('fallback');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const refresh = () => {
      fetch('/api/v1/public/exchange-rates', { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Rate request failed (${response.status})`);
          return response.json();
        })
        .then((responseData) => {
          if (cancelled) return;
          const payload = responseData?.data ?? responseData;
          if (payload.formatted) {
            setRates(payload.formatted);
            setStatus(payload.ok ? 'live' : 'fallback');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRates(fallbackRates);
            setStatus('fallback');
          }
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [fallbackRates]);

  return { rates, status };
}

export { useExchangeRates };
