import { apiGet } from "./client";

export interface StorageStatus {
  driver: string;
  implementation: "ready" | "skeleton";
  publicUrl: string;
  path?: string;
  endpoint?: string;
  port?: number;
  useSsl?: boolean;
  bucket?: string;
  region?: string;
  credentialsConfigured?: boolean;
}

export interface MailStatus {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  passwordConfigured: boolean;
  fromName: string;
  fromAddress: string;
}

export interface SystemLogEntry {
  timestamp: string;
  level: "debug" | "log" | "warn" | "error" | "fatal";
  context?: string;
  message: unknown;
  trace?: string;
}

export type SystemInfo = Record<string, unknown>;

export const getStorageStatus = () =>
  apiGet<StorageStatus>("/admin/system/storage");
export const getMailStatus = () => apiGet<MailStatus>("/admin/system/mail");
export const getSystemLogs = (params?: { limit?: number; level?: string }) =>
  apiGet<SystemLogEntry[]>("/admin/system/logs", params);
export const getSystemInfo = () => apiGet<SystemInfo>("/admin/system/info");
