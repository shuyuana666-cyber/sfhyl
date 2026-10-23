import { apiGet, apiPatch } from "./client";

export const getSettings = () =>
  apiGet<Record<string, Record<string, unknown>>>("/admin/settings");
export const updateSettings = (group: string, settings: object) =>
  apiPatch<Record<string, unknown>>(`/admin/settings/${group}`, { settings });
