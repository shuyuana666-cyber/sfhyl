import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminUserStatus, type AdminUser } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshTokenPayload,
} from '../common/interfaces/authenticated-user';
import type { RequestMeta } from '../common/utils/request-meta';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { menuForPermissions } from './auth-menu';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresAt: Date;
}

interface BuiltTokenPair extends TokenPair {
  refreshRecord: {
    adminUserId: bigint;
    tokenHash: string;
    familyId: string;
    deviceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta, deviceId?: string): Promise<TokenPair> {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.prisma.adminUser.findFirst({
      where: {
        OR: [{ username: dto.identifier.trim() }, { email: identifier }],
        deletedAt: null,
      },
    });

    if (!user) {
      await bcrypt.hash(dto.password, 12);
      await this.writeLoginLog(null, dto.identifier, false, 'INVALID_CREDENTIALS', meta);
      throw new UnauthorizedException('用户名、邮箱或密码错误');
    }

    if (user.status === AdminUserStatus.DISABLED) {
      await this.writeLoginLog(user.id, dto.identifier, false, 'ACCOUNT_DISABLED', meta);
      throw new UnauthorizedException('管理员账号已停用');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.writeLoginLog(user.id, dto.identifier, false, 'ACCOUNT_LOCKED', meta);
      throw new UnauthorizedException('登录失败次数过多，请稍后再试');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.recordFailedLogin(user, dto.identifier, meta);
      throw new UnauthorizedException('用户名、邮箱或密码错误');
    }

    const loginAt = new Date();
    const tokens = await this.buildTokenPair(user, meta, randomUUID(), deviceId ?? null, dto.remember);
    await this.prisma.$transaction(async (transaction) => {
      const activated = await transaction.adminUser.updateMany({
        where: {
          id: user.id,
          passwordHash: user.passwordHash,
          status: { in: [AdminUserStatus.ACTIVE, AdminUserStatus.LOCKED] },
          deletedAt: null,
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: loginAt } }],
        },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: AdminUserStatus.ACTIVE,
          lastLoginAt: loginAt,
        },
      });
      if (activated.count !== 1) {
        throw new UnauthorizedException('管理员账号已停用或已更新，请重新登录');
      }
      await transaction.refreshToken.create({ data: tokens.refreshRecord });
      await transaction.loginLog.create({
        data: {
          adminUserId: user.id,
          identifier: dto.identifier,
          success: true,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        },
      });
    });
    return this.publicTokens(tokens);
  }

  async refresh(rawToken: string, meta: RequestMeta, deviceId?: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(rawToken);
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { adminUser: true },
    });

    if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: payload.family, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'refresh_token_reuse' },
      });
      throw new UnauthorizedException('刷新令牌无效或已被使用');
    }
    if (
      existing.adminUser.status !== AdminUserStatus.ACTIVE ||
      existing.adminUser.deletedAt ||
      existing.adminUserId.toString() !== payload.sub
    ) {
      throw new UnauthorizedException('管理员已禁用或不存在');
    }

    const tokens = await this.buildTokenPair(existing.adminUser, meta, existing.familyId, deviceId ?? existing.deviceId);
    await this.prisma.$transaction(async (transaction) => {
      const replacement = await transaction.refreshToken.create({ data: tokens.refreshRecord });
      const result = await transaction.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'rotated', replacedById: replacement.id },
      });
      if (result.count !== 1) throw new ConflictException('刷新令牌已被其他请求使用');
    });
    return this.publicTokens(tokens);
  }

  async logout(rawToken: string, userId: bigint): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), adminUserId: userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'logout' },
    });
  }

  async logoutAll(userId: bigint): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { adminUserId: userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'logout_all' },
    });
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('当前密码错误');
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new ConflictException('新密码不能与当前密码相同');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { adminUserId: userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'password_changed' },
      }),
    ]);
  }

  me(user: AuthenticatedUser): Record<string, unknown> {
    return { ...user, menus: menuForPermissions(user.permissions) };
  }

  private async buildTokenPair(
    user: AdminUser,
    meta: RequestMeta,
    familyId: string,
    deviceId: string | null,
    remember = true,
  ): Promise<BuiltTokenPair> {
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const configuredRefresh = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshExpiresIn = remember ? configuredRefresh : '1d';
    const accessPayload: AccessTokenPayload = { sub: user.id.toString(), username: user.username, type: 'access' };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id.toString(),
      family: familyId,
      jti: randomUUID(),
      type: 'refresh',
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn as never,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as never,
      }),
    ]);
    const decoded = this.jwt.decode<RefreshTokenPayload>(refreshToken);
    if (!decoded.exp) throw new Error('Refresh token has no expiration.');
    const refreshExpiresAt = new Date(decoded.exp * 1000);

    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      refreshExpiresAt,
      refreshRecord: {
        adminUserId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        deviceId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt: refreshExpiresAt,
      },
    };
  }

  private publicTokens(tokens: BuiltTokenPair): TokenPair {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresIn: tokens.accessExpiresIn,
      refreshExpiresAt: tokens.refreshExpiresAt,
    };
  }

  private async verifyRefreshToken(rawToken: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh' || !payload.family || !/^\d+$/.test(payload.sub)) throw new Error('invalid');
      return payload;
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordFailedLogin(user: AdminUser, identifier: string, meta: RequestMeta): Promise<void> {
    const maxAttempts = this.config.get<number>('LOGIN_MAX_ATTEMPTS', 5);
    const lockMinutes = this.config.get<number>('LOGIN_LOCK_MINUTES', 15);
    await this.prisma.$transaction(async (transaction) => {
      const incremented = await transaction.adminUser.updateMany({
        where: {
          id: user.id,
          passwordHash: user.passwordHash,
          status: { in: [AdminUserStatus.ACTIVE, AdminUserStatus.LOCKED] },
          deletedAt: null,
        },
        data: {
          failedLoginAttempts: { increment: 1 },
        },
      });
      const updatedUser = incremented.count === 1
        ? await transaction.adminUser.findUnique({
            where: { id: user.id },
            select: { failedLoginAttempts: true },
          })
        : null;
      const locked = (updatedUser?.failedLoginAttempts ?? user.failedLoginAttempts) >= maxAttempts;
      if (locked && incremented.count === 1) {
        await transaction.adminUser.updateMany({
          where: {
            id: user.id,
            status: { in: [AdminUserStatus.ACTIVE, AdminUserStatus.LOCKED] },
            deletedAt: null,
          },
          data: {
            status: AdminUserStatus.LOCKED,
            lockedUntil: new Date(Date.now() + lockMinutes * 60_000),
          },
        });
      }
      await transaction.loginLog.create({
        data: {
          adminUserId: user.id,
          identifier,
          success: false,
          failureCode: locked ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        },
      });
    });
  }

  private async writeLoginLog(
    userId: bigint | null,
    identifier: string,
    success: boolean,
    failureCode: string | null,
    meta: RequestMeta,
  ): Promise<void> {
    await this.prisma.loginLog.create({
      data: {
        adminUserId: userId,
        identifier,
        success,
        failureCode,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
  }
}
