import type { PageData } from "@/types/api";
import type { MediaAsset, MediaUploadRecord } from "@/types/business";
import { apiDelete, apiGet, apiPatch, apiPost, apiRequest } from "./client";

const MEDIA_UPLOAD_TIMEOUT = 600000;

export interface MediaFolder {
  id: string;
  name: string;
  slug?: string | null;
  parentId?: string | null;
  _count?: { assets: number; children?: number };
}
export const getMedia = (params?: object) =>
  apiGet<PageData<MediaAsset>>("/admin/media", params);
export const getMediaUploads = (params?: object) =>
  apiGet<PageData<MediaUploadRecord>>("/admin/media/uploads", params);
export const clearMediaUploads = () =>
  apiDelete<{ affected: number }>("/admin/media/uploads");
export const getFolders = () => apiGet<MediaFolder[]>("/admin/media/folders");
export const batchMedia = (data: {
  ids: string[];
  action: "MOVE" | "ARCHIVE" | "DELETE";
  folderId?: string | null;
}) => apiPost<{ affected: number }>("/admin/media/batch-action", data);
export const uploadMedia = (
  data: FormData,
  onProgress?: (percentage: number) => void
) =>
  apiRequest<MediaAsset>("post", "/admin/media/upload", {
    data,
    timeout: MEDIA_UPLOAD_TIMEOUT,
    onUploadProgress: event => {
      const ratio = event.total
        ? event.loaded / event.total
        : (event.progress ?? 0);
      onProgress?.(Math.min(100, Math.round(ratio * 100)));
    }
  });
export const updateMedia = (id: string, data: object) =>
  apiPatch<MediaAsset>(`/admin/media/${id}`, data);
export const archiveMedia = (id: string) => apiDelete(`/admin/media/${id}`);
export const restoreMedia = (id: string) =>
  apiPost<MediaAsset>(`/admin/media/${id}/restore`);
export const permanentlyDeleteMedia = (id: string) =>
  apiDelete(`/admin/media/${id}/permanent`);
export const createFolder = (data: object) =>
  apiPost<MediaFolder>("/admin/media/folders", data);
export const updateFolder = (id: string, data: object) =>
  apiPatch<MediaFolder>(`/admin/media/folders/${id}`, data);
export const deleteFolder = (id: string) =>
  apiDelete(`/admin/media/folders/${id}`);
