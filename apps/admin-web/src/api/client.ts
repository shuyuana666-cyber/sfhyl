import { http } from "@/utils/http";
import type { AxiosRequestConfig } from "axios";
import type { ApiEnvelope } from "@/types/api";
import type { RequestMethods } from "@/utils/http/types";

export async function apiRequest<T>(
  method: RequestMethods,
  url: string,
  config: Omit<AxiosRequestConfig, "method" | "url"> = {}
): Promise<T> {
  const response = await http.request<ApiEnvelope<T>>(method, url, config);
  return response.data;
}

export const apiGet = <T>(url: string, params?: object) =>
  apiRequest<T>("get", url, { params });

export const apiPost = <T>(url: string, data?: unknown) =>
  apiRequest<T>("post", url, { data });

export const apiPut = <T>(url: string, data?: unknown) =>
  apiRequest<T>("put", url, { data });

export const apiPatch = <T>(url: string, data?: unknown) =>
  apiRequest<T>("patch", url, { data });

export const apiDelete = <T>(url: string) => apiRequest<T>("delete", url);

export async function download(url: string, params?: object): Promise<Blob> {
  return http.request<Blob>("get", url, { params, responseType: "blob" });
}

export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
