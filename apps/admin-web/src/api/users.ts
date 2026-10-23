import type { PageData } from "@/types/api";
import type { Role } from "./roles";
import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  status: "ACTIVE" | "DISABLED" | "LOCKED";
  lastLoginAt?: string | null;
  roles?: Array<{ role: Role }>;
  createdAt: string;
  updatedAt: string;
}
export const getUsers = (params?: object) =>
  apiGet<PageData<AdminUser>>("/admin/users", params);
export const createUser = (data: object) =>
  apiPost<AdminUser>("/admin/users", data);
export const updateUser = (id: string, data: object) =>
  apiPatch<AdminUser>(`/admin/users/${id}`, data);
export const deleteUser = (id: string) => apiDelete(`/admin/users/${id}`);
