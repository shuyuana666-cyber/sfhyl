const API_BASE = (import.meta.env.VITE_PUBLIC_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

function createRequestSignal(timeoutMs, parentSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);

  if (parentSignal?.aborted) {
    abort();
  } else {
    parentSignal?.addEventListener('abort', abort, { once: true });
  }

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', abort);
    },
  };
}

export async function apiRequest(path, options = {}) {
  const {
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    signal: parentSignal,
    ...fetchOptions
  } = options;
  const requestSignal = createRequestSignal(timeoutMs, parentSignal);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: requestSignal.signal,
      headers: { Accept: 'application/json', ...(fetchOptions.headers || {}) },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = Array.isArray(payload?.message)
        ? payload.message.join(', ')
        : payload?.message || `Request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload?.data ?? payload;
  } finally {
    requestSignal.clear();
  }
}
