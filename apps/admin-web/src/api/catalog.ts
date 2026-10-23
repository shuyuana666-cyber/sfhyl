import type {
  Brand,
  VehicleCategory,
  VehicleModel,
  VehicleSeries,
  VehicleTag
} from "@/types/business";
import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export type CatalogRecord =
  Brand | VehicleSeries | VehicleModel | VehicleCategory | VehicleTag;
export const getBrands = (params?: object) =>
  apiGet<Brand[]>("/admin/brands", params);
export const getSeries = (params?: object) =>
  apiGet<VehicleSeries[]>("/admin/series", params);
export const getModels = (params?: object) =>
  apiGet<VehicleModel[]>("/admin/models", params);
export const getTags = (params?: object) =>
  apiGet<VehicleTag[]>("/admin/tags", params);
export const getCategories = (params?: object) =>
  apiGet<VehicleCategory[]>("/admin/categories", params);
export const createQuickBrand = (name: string) =>
  apiPost<Brand>("/admin/brands/quick-create", { name });

export const createCatalog = (kind: string, data: object) =>
  apiPost<CatalogRecord>(`/admin/${kind}`, data);
export const updateCatalog = (kind: string, id: string, data: object) =>
  apiPatch<CatalogRecord>(`/admin/${kind}/${id}`, data);
export const deleteCatalog = (kind: string, id: string) =>
  apiDelete(`/admin/${kind}/${id}`);
