import { apiGet } from "./client";

export interface DashboardData {
  period: { from: string; to: string };
  summary: Record<string, number>;
  inquiryTrend: Array<{ date: string; count: number }>;
  vehicleTrend: Array<{ date: string; count: number }>;
  recentLogins: DashboardLogin[];
  recentAudits: DashboardAudit[];
  topVehicles: DashboardVehicle[];
}

export interface DashboardLogin {
  id: string;
  identifier: string;
  ipAddress?: string | null;
  success: boolean;
  createdAt: string;
}
export interface DashboardAudit {
  id: string;
  actorName?: string | null;
  action: string;
  summary?: string | null;
  createdAt: string;
}
export interface DashboardVehicle {
  id: string;
  stockNo: string;
  nameZh: string;
  nameEn?: string;
  slug?: string;
  _count?: { inquiries: number };
}

export const getDashboard = (params?: object) =>
  apiGet<DashboardData>("/admin/dashboard", params);
