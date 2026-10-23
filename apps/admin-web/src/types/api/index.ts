export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageData<T> {
  items: T[];
  pagination: Pagination;
}

export interface IdRecord {
  id: string;
}
