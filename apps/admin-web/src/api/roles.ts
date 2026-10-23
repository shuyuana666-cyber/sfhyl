import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export interface Permission {
  id: string;
  code: string;
  module: string;
  nameZh: string;
  nameEn: string;
  description?: string | null;
}
export interface Role {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  description?: string | null;
  isSystem: boolean;
  isEnabled: boolean;
  permissions?: Array<{ permission: Permission }>;
  _count?: { users: number };
}
export const getRoles = () => apiGet<Role[]>("/admin/roles");
export const getPermissions = () => apiGet<Permission[]>("/admin/permissions");
export const createRole = (data: object) => apiPost<Role>("/admin/roles", data);
export const updateRole = (id: string, data: object) =>
  apiPatch<Role>(`/admin/roles/${id}`, data);
export const deleteRole = (id: string) => apiDelete(`/admin/roles/${id}`);
