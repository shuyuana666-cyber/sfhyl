import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AdminUserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AccessTokenPayload, AuthenticatedUser } from '../common/interfaces/authenticated-user';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access' || !/^\d+$/.test(payload.sub)) throw new UnauthorizedException('无效访问令牌');

    const user = await this.prisma.adminUser.findFirst({
      where: { id: BigInt(payload.sub), status: AdminUserStatus.ACTIVE, deletedAt: null },
      include: {
        roles: {
          where: { role: { isEnabled: true, deletedAt: null } },
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    if (!user) throw new UnauthorizedException('管理员已禁用或不存在');

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      roleCodes: user.roles.map(({ role }) => role.code),
      permissions: [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code)))],
    };
  }
}
