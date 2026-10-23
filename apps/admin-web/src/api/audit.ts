import type { PageData } from "@/types/api";
import { apiGet } from "./client";

export interface LogRecord {
  id: string;
  createdAt: string;
  actorName?: string | null;
  adminUser?: {
    id: string;
    username: string;
    displayName?: string | null;
  } | null;
  identifier?: string;
  success?: boolean;
  failureCode?: string | null;
  action?: string;
  resourceType?: string;
  resourceId?: string | null;
  summary?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
}
export const getAuditLogs = (params?: object) =>
  apiGet<PageData<LogRecord>>("/admin/audit-logs", params);
export const getLoginLogs = (params?: object) =>
  apiGet<PageData<LogRecord>>("/admin/login-logs", params);
