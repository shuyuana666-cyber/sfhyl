import type { PageData } from "@/types/api";
import type { MediaAsset } from "@/types/business";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";

export interface ContentRecord {
  id: string;
  key?: string;
  parentId?: string | null;
  parent?: { id: string; labelZh: string; labelEn: string } | null;
  labelZh?: string | null;
  labelEn?: string | null;
  labelRu?: string | null;
  href?: string | null;
  target?: string;
  isEnabled?: boolean;
  sortOrder?: number;
  titleZh?: string | null;
  titleEn?: string | null;
  titleRu?: string | null;
  slug?: string;
  status?: "DRAFT" | "PUBLISHED" | "OFFLINE" | "ARCHIVED";
  content?: Record<string, unknown> | null;
  publishedAt?: string | null;
  updatedAt?: string;
  deletedAt?: string | null;
  seoTitle?: string | null;
  seoKeywords?: string | null;
  seoDescription?: string | null;
  ogMediaId?: string | null;
  media?: Record<string, MediaAsset>;
}
export const getNavigation = (params?: object) =>
  apiGet<ContentRecord[]>("/admin/navigation", params);
export const createNavigation = (data: object) =>
  apiPost<ContentRecord>("/admin/navigation", data);
export const updateNavigation = (id: string, data: object) =>
  apiPatch<ContentRecord>(`/admin/navigation/${id}`, data);
export const deleteNavigation = (id: string) =>
  apiDelete(`/admin/navigation/${id}`);
export const sortNavigation = (
  items: Array<{ id: string; sortOrder: number }>
) => apiPut("/admin/navigation/sort", { items });

export const getPages = (params?: object) =>
  apiGet<PageData<ContentRecord>>("/admin/pages", params);
export const getPage = (id: string) =>
  apiGet<ContentRecord>(`/admin/pages/${id}`);
export const createPage = (data: object) =>
  apiPost<ContentRecord>("/admin/pages", data);
export const updatePage = (id: string, data: object) =>
  apiPatch<ContentRecord>(`/admin/pages/${id}`, data);
export const publishPage = (id: string) =>
  apiPost<ContentRecord>(`/admin/pages/${id}/publish`);
export const deletePage = (id: string) => apiDelete(`/admin/pages/${id}`);
export const restorePage = (id: string) =>
  apiPost<ContentRecord>(`/admin/pages/${id}/restore`);

export const getHomepageContent = () =>
  apiGet<ContentRecord>("/admin/homepage-content");
export const updateHomepageContent = (content: Record<string, unknown>) =>
  apiPut<ContentRecord>("/admin/homepage-content", { content });
export const publishHomepageContent = () =>
  apiPost<ContentRecord>("/admin/homepage-content/publish");
