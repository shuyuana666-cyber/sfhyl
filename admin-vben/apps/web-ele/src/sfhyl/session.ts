import { requestClient } from '#/api/request';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: null | string;
  roleCodes: string[];
  permissions: string[];
  menus: Array<{
    path: string;
    title: string;
    children?: Array<{ path: string; title: string }>;
  }>;
}

export interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
  requestId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresAt: string;
}

let currentUserCache: AdminUser | undefined;
let currentUserRequest: Promise<AdminUser> | undefined;

export function clearCurrentUserCache(): void {
  currentUserCache = undefined;
  currentUserRequest = undefined;
}

export async function getCurrentUser(forceRefresh = false): Promise<AdminUser> {
  if (forceRefresh) {
    clearCurrentUserCache();
  }
  if (currentUserCache) {
    return currentUserCache;
  }
  if (!currentUserRequest) {
    currentUserRequest = requestClient
      .get<AdminUser>('/auth/me')
      .then((user) => {
        currentUserCache = user;
        return user;
      })
      .finally(() => {
        currentUserRequest = undefined;
      });
  }
  return currentUserRequest;
}
