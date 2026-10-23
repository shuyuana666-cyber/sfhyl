import type { ApiEnvelope, TokenPair } from '#/sfhyl/session';

import { useAccessStore } from '@vben/stores';

import { baseRequestClient, requestClient } from '#/api/request';
import { clearCurrentUserCache, getCurrentUser } from '#/sfhyl/session';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    refreshToken: string;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  clearCurrentUserCache();
  return requestClient.post<AuthApi.LoginResult>('/auth/login', {
    identifier: data.username,
    password: data.password,
    remember: false,
  });
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  const accessStore = useAccessStore();
  if (!accessStore.refreshToken) {
    throw new Error('Refresh token is missing');
  }
  const response = (await baseRequestClient.post<ApiEnvelope<TokenPair>>(
    '/auth/refresh',
    { refreshToken: accessStore.refreshToken },
  )) as unknown as { data: ApiEnvelope<TokenPair> };
  accessStore.setRefreshToken(response.data.data.refreshToken);
  return response.data.data.accessToken;
}

/**
 * 退出登录
 */
export async function logoutApi() {
  const refreshToken = useAccessStore().refreshToken;
  if (!refreshToken) {
    return;
  }
  return baseRequestClient.post('/auth/logout', { refreshToken });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return (await getCurrentUser()).permissions;
}
