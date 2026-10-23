import type { PageData } from "@/types/api";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  download,
  saveBlob
} from "./client";

export type InquiryStatus =
  "NEW" | "CONTACTED" | "FOLLOWING" | "QUOTED" | "WON" | "LOST" | "INVALID";
export interface InquiryUserRef {
  id: string;
  username: string;
  displayName?: string | null;
}
export interface InquiryAssignment {
  id: string;
  assignedToId: string;
  assignedAt: string;
  endedAt?: string | null;
  assignedTo?: InquiryUserRef;
  assignedBy?: InquiryUserRef;
}
export interface InquiryNote {
  id: string;
  content: string;
  createdAt: string;
  author?: InquiryUserRef;
}
export interface InquiryNoteRecord extends InquiryNote {
  inquiry: {
    id: string;
    name: string;
    companyName?: string | null;
    status: InquiryStatus;
    vehicle?: { stockNo: string; nameZh: string } | null;
  };
}
export interface Inquiry {
  id: string;
  status: InquiryStatus;
  source: "WEBSITE" | "WHATSAPP" | "MANUAL" | "OTHER";
  sourcePage?: string | null;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  companyName?: string | null;
  country?: string | null;
  message?: string | null;
  clientIp?: string | null;
  createdAt: string;
  vehicle?: { id: string; nameZh: string; stockNo: string } | null;
  assignments?: InquiryAssignment[];
  notes?: InquiryNote[];
}
export interface InquiryAssignee {
  id: string;
  username: string;
  displayName?: string | null;
}
export const getInquiries = (params?: object) =>
  apiGet<PageData<Inquiry>>("/admin/inquiries", params);
export const getInquiryAssignees = () =>
  apiGet<InquiryAssignee[]>("/admin/inquiries/assignees");
export const getInquiry = (id: string) =>
  apiGet<Inquiry>(`/admin/inquiries/${id}`);
export const getInquiryNotes = (params?: object) =>
  apiGet<PageData<InquiryNoteRecord>>("/admin/inquiries/notes", params);
export const updateInquiry = (id: string, data: object) =>
  apiPatch<Inquiry>(`/admin/inquiries/${id}`, data);
export const addInquiryNote = (id: string, content: string) =>
  apiPost(`/admin/inquiries/${id}/notes`, { content, isInternal: true });
export const assignInquiry = (id: string, assignedToId: string) =>
  apiPost(`/admin/inquiries/${id}/assign`, { assignedToId });
export const batchInquiryStatus = (ids: string[], status: string) =>
  apiPost("/admin/inquiries/batch-status", { ids, status });
export const batchInquiryAssign = (ids: string[], assignedToId: string) =>
  apiPost("/admin/inquiries/batch-assign", { ids, assignedToId });
export const archiveInquiry = (id: string) =>
  apiDelete(`/admin/inquiries/${id}`);
export const exportInquiries = async (params?: object) =>
  saveBlob(await download("/admin/inquiries/export", params), "inquiries.csv");
