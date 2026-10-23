export interface ApiSuccess<T> {
  code: 0;
  message: 'success';
  data: T;
  requestId: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: Pagination;
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number): PaginatedData<T> {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
