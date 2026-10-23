import type { RequestClientConfig } from '@vben/request';

import { requestClient } from '#/api/request';

export type RequestMethods =
  | 'delete'
  | 'get'
  | 'head'
  | 'options'
  | 'patch'
  | 'post'
  | 'put';

export async function apiRequest<T>(
  method: RequestMethods,
  url: string,
  config: Omit<RequestClientConfig, 'method' | 'url'> = {},
): Promise<T> {
  return requestClient.request<T>(url, {
    ...config,
    method: method.toUpperCase() as RequestClientConfig['method'],
  });
}

export const apiGet = <T>(url: string, params?: object) =>
  apiRequest<T>('get', url, { params });

export const apiPost = <T>(url: string, data?: unknown) =>
  apiRequest<T>('post', url, { data });

export const apiPut = <T>(url: string, data?: unknown) =>
  apiRequest<T>('put', url, { data });

export const apiPatch = <T>(url: string, data?: unknown) =>
  apiRequest<T>('patch', url, { data });

export const apiDelete = <T>(url: string) => apiRequest<T>('delete', url);

export async function download(url: string, params?: object): Promise<Blob> {
  const response = (await requestClient.request<{ data: Blob }>(url, {
    method: 'GET',
    params,
    responseReturn: 'raw',
    responseType: 'blob',
  })) as unknown as { data: Blob };
  return response.data;
}

export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
