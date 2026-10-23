import { apiGet, apiPost, apiPut, apiRequest } from "./client";

export type UserResult = {
  success: boolean;
  data: {
    avatar: string;
    username: string;
    nickname: string;
    roles: string[];
    permissions: string[];
    accessToken: string;
    refreshToken: string;
    expires: Date;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expires: Date;
  };
};

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresAt: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  roleCodes: string[];
  permissions: string[];
  menus: Array<{
    path: string;
    title: string;
    children?: Array<{ path: string; title: string }>;
  }>;
}

function tokenExpiry(token: string): Date {
  try {
    const encoded = token.split(".")[1];
    const payload = JSON.parse(
      atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return new Date(Number(payload.exp) * 1000);
  } catch {
    return new Date(Date.now() + 15 * 60_000);
  }
}

export const getLogin = (data?: object): Promise<UserResult> => {
  const input = data as {
    username: string;
    password: string;
    remember?: boolean;
  };
  return apiPost<TokenPair>("/auth/login", {
    identifier: input.username,
    password: input.password,
    remember: input.remember ?? false
  }).then(async tokens => {
    const user = await apiRequest<CurrentUser>("get", "/auth/me", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` }
    });
    return {
      success: true,
      data: {
        avatar: "",
        username: user.username,
        nickname: user.displayName || user.username,
        roles: user.roleCodes,
        permissions: user.permissions,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expires: tokenExpiry(tokens.accessToken)
      }
    };
  });
};

export const loginWithTokens = (tokens: TokenPair): Promise<UserResult> =>
  apiRequest<CurrentUser>("get", "/auth/me", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` }
  }).then(user => ({
    success: true,
    data: {
      avatar: "",
      username: user.username,
      nickname: user.displayName || user.username,
      roles: user.roleCodes,
      permissions: user.permissions,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expires: tokenExpiry(tokens.accessToken)
    }
  }));

export const refreshTokenApi = (data?: object): Promise<RefreshTokenResult> =>
  apiPost<TokenPair>("/auth/refresh", data).then(tokens => ({
    success: true,
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expires: tokenExpiry(tokens.accessToken)
    }
  }));

export const getCurrentUser = () => apiGet<CurrentUser>("/auth/me");
export const logoutApi = (refreshToken: string) =>
  apiPost<{ revoked: true }>("/auth/logout", { refreshToken });
export const changePasswordApi = (data: object) =>
  apiPut<{ changed: true }>("/auth/password", data);
