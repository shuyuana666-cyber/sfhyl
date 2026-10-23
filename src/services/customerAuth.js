import { apiRequest } from './apiClient.js';

const SESSION_STORAGE_KEY = 'sfhyl-customer-session';

function request(path, options = {}) {
  const { token, body, headers = {}, ...fetchOptions } = options;
  const requestHeaders = { ...headers };

  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  return apiRequest(path, {
    ...fetchOptions,
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function customerSession() {
  try {
    const value = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!value) return null;

    const session = JSON.parse(value);
    return session && typeof session === 'object' ? session : null;
  } catch {
    clearCustomerSession();
    return null;
  }
}

export function saveCustomerSession(tokens) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(tokens));
}

export function clearCustomerSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function unifiedLogin(data) {
  return request('/public/auth/login', { method: 'POST', body: data });
}

export function registerCustomer(data) {
  return request('/public/auth/register', { method: 'POST', body: data });
}

export function customerMe({ signal } = {}) {
  return request('/public/auth/me', {
    token: customerSession()?.accessToken,
    signal,
  });
}

export function updateCustomer(data, { signal } = {}) {
  return request('/public/auth/me', {
    method: 'PUT',
    body: data,
    token: customerSession()?.accessToken,
    signal,
  });
}

export function customerInquiries({ signal } = {}) {
  return request('/public/auth/inquiries', {
    token: customerSession()?.accessToken,
    signal,
  });
}

export function customerLogout({ signal } = {}) {
  const session = customerSession();
  return request('/public/auth/logout', {
    method: 'POST',
    body: { refreshToken: session?.refreshToken },
    token: session?.accessToken,
    signal,
  });
}
