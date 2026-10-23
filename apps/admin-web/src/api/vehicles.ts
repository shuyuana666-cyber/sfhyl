import type { PageData } from "@/types/api";
import type { Vehicle } from "@/types/business";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiRequest,
  download,
  saveBlob
} from "./client";

const VEHICLE_SAVE_TIMEOUT = 180000;

export const getVehicles = (params?: object) =>
  apiGet<PageData<Vehicle>>("/admin/vehicles", params);
export const getVehicle = (id: string) =>
  apiGet<Vehicle>(`/admin/vehicles/${id}`);
export const createVehicle = (data: object) =>
  apiRequest<Vehicle>("post", "/admin/vehicles", {
    data,
    timeout: VEHICLE_SAVE_TIMEOUT
  });
export const updateVehicle = (id: string, data: object) =>
  apiRequest<Vehicle>("patch", `/admin/vehicles/${id}`, {
    data,
    timeout: VEHICLE_SAVE_TIMEOUT
  });
export const deleteVehicle = (id: string) => apiDelete(`/admin/vehicles/${id}`);
export const publishVehicle = (id: string) =>
  apiPost<Vehicle>(`/admin/vehicles/${id}/publish`);
export const offlineVehicle = (id: string) =>
  apiPost<Vehicle>(`/admin/vehicles/${id}/offline`);
export const restoreVehicle = (id: string) =>
  apiPost<Vehicle>(`/admin/vehicles/${id}/restore`);
export const duplicateVehicle = (id: string) =>
  apiPost<Vehicle>(`/admin/vehicles/${id}/duplicate`);
export const setVehicleSaleStatus = (id: string, saleStatus: string) =>
  apiPost<Vehicle>(`/admin/vehicles/${id}/sale-status`, { saleStatus });
export const setVehicleFeatured = (id: string, isFeatured: boolean) =>
  apiPost<Vehicle>(`/admin/vehicles/${id}/featured`, { isFeatured });
export const batchVehicles = (ids: string[], action: string) =>
  apiPost<{ affected: number }>("/admin/vehicles/batch-action", {
    ids,
    action
  });
export const exportVehicles = async (params?: object) =>
  saveBlob(await download("/admin/vehicles/export", params), "vehicles.csv");
