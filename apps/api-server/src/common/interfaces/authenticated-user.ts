export interface AuthenticatedUser {
  id: bigint;
  username: string;
  email: string;
  displayName: string | null;
  roleCodes: string[];
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  family: string;
  jti: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}
