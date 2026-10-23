import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { CustomerStatus, type Customer } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import type { RequestMeta } from "../common/utils/request-meta";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import type {
  CustomerLoginDto,
  CustomerProfileDto,
  CustomerRegisterDto,
} from "./dto/customer-auth.dto";

type CustomerPayload = {
  sub: string;
  kind: "customer";
  type: "access" | "refresh";
  family?: string;
  jti?: string;
  exp?: number;
};

type Tokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresAt: Date;
};

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: CustomerRegisterDto, meta: RequestMeta): Promise<Tokens> {
    const email = dto.email.trim().toLowerCase();
    const phone = this.phone(dto.phone);
    const [admin, existing] = await Promise.all([
      this.prisma.adminUser.findUnique({ where: { email } }),
      this.prisma.customer.findFirst({
        where: {
          OR: [{ email }, { phone }],
          deletedAt: null,
        },
      }),
    ]);

    if (admin || existing) throw new ConflictException("手机号或邮箱已被使用。");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.create({
        data: {
          name: dto.name.trim(),
          companyName: dto.companyName?.trim() || null,
          phone,
          email,
          passwordHash,
        },
      });

      // Contact details have not been verified at registration. Automatically
      // claiming historical inquiries here would expose another person's data.
      const tokens = await this.tokens(customer, meta, randomUUID(), null, true);
      await transaction.customerRefreshToken.create({
        data: {
          customerId: customer.id,
          tokenHash: this.hash(tokens.refreshToken),
          familyId: this.family(tokens.refreshToken),
          expiresAt: tokens.refreshExpiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
      return tokens;
    });
  }

  async login(
    dto: CustomerLoginDto,
    meta: RequestMeta,
    deviceId?: string,
  ): Promise<Tokens> {
    const identifier = dto.identifier.trim().toLowerCase();
    const phone = this.phone(dto.identifier);
    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [{ email: identifier }, { phone }],
        deletedAt: null,
      },
    });

    if (!customer || customer.status !== CustomerStatus.ACTIVE ||
      (customer.lockedUntil && customer.lockedUntil > new Date())) {
      throw new UnauthorizedException("账号或密码错误。");
    }

    if (!(await bcrypt.compare(dto.password, customer.passwordHash))) {
      await this.recordFailedLogin(customer);
      throw new UnauthorizedException("账号或密码错误。");
    }

    const tokens = await this.tokens(
      customer,
      meta,
      randomUUID(),
      deviceId ?? null,
      dto.remember !== false,
    );

    await this.prisma.$transaction(async (transaction) => {
      const loginAt = new Date();
      const activated = await transaction.customer.updateMany({
        where: {
          id: customer.id,
          passwordHash: customer.passwordHash,
          status: CustomerStatus.ACTIVE,
          deletedAt: null,
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: loginAt } }],
        },
        data: { lastLoginAt: loginAt, failedLoginAttempts: 0, lockedUntil: null },
      });
      if (activated.count !== 1) throw new UnauthorizedException("账号或密码错误。");
      await transaction.customerRefreshToken.create({
        data: {
          customerId: customer.id,
          tokenHash: this.hash(tokens.refreshToken),
          familyId: this.family(tokens.refreshToken),
          deviceId: deviceId ?? null,
          expiresAt: tokens.refreshExpiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
    });

    return tokens;
  }

  async refresh(raw: string, meta: RequestMeta, deviceId?: string): Promise<Tokens> {
    const payload = await this.verify(raw, "refresh");
    const record = await this.prisma.customerRefreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
      include: { customer: true },
    });

    if (
      !record ||
      record.revokedAt ||
      record.expiresAt <= new Date() ||
      record.customer.status !== CustomerStatus.ACTIVE ||
      record.customer.deletedAt ||
      record.customerId.toString() !== payload.sub
    ) {
      throw new UnauthorizedException("刷新令牌无效。");
    }

    const retainedDeviceId = deviceId ?? record.deviceId;
    const tokens = await this.tokens(record.customer, meta, record.familyId, retainedDeviceId, true);

    await this.prisma.$transaction(async (transaction) => {
      const rotatedAt = new Date();
      const replacement = await transaction.customerRefreshToken.create({
        data: {
          customerId: record.customerId,
          tokenHash: this.hash(tokens.refreshToken),
          familyId: record.familyId,
          deviceId: retainedDeviceId,
          expiresAt: tokens.refreshExpiresAt,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      const rotation = await transaction.customerRefreshToken.updateMany({
        where: {
          id: record.id,
          revokedAt: null,
          expiresAt: { gt: rotatedAt },
        },
        data: {
          revokedAt: rotatedAt,
          revokeReason: "rotated",
          replacedById: replacement.id,
        },
      });

      if (rotation.count !== 1) {
        throw new UnauthorizedException("刷新令牌无效。");
      }
    });

    return tokens;
  }

  async customerFromAccess(token: string): Promise<Customer> {
    const payload = await this.verify(token, "access");
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: BigInt(payload.sub),
        status: CustomerStatus.ACTIVE,
        deletedAt: null,
      },
    });

    if (!customer) throw new UnauthorizedException("客户账号不可用。");
    return customer;
  }

  profile(customer: Customer) {
    return {
      id: customer.id.toString(),
      name: customer.name,
      companyName: customer.companyName,
      phone: customer.phone,
      email: customer.email,
      status: customer.status,
      lastLoginAt: customer.lastLoginAt,
      createdAt: customer.createdAt,
    };
  }

  async updateProfile(customer: Customer, dto: CustomerProfileDto): Promise<Customer> {
    const email = dto.email.trim().toLowerCase();
    const phone = this.phone(dto.phone);
    const [existingCustomer, admin] = await Promise.all([
      this.prisma.customer.findFirst({
        where: {
          id: { not: customer.id },
          deletedAt: null,
          OR: [{ email }, { phone }],
        },
      }),
      this.prisma.adminUser.findUnique({ where: { email } }),
    ]);

    if (existingCustomer || admin) throw new ConflictException("手机号或邮箱已被使用。");

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: dto.name.trim(),
        companyName: dto.companyName?.trim() || null,
        phone,
        email,
      },
    });
  }

  async logout(customerId: bigint, raw: string) {
    await this.prisma.customerRefreshToken.updateMany({
      where: {
        customerId,
        tokenHash: this.hash(raw),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: "logout",
      },
    });
  }

  private async tokens(
    customer: Customer,
    meta: RequestMeta,
    family: string,
    deviceId: string | null,
    remember: boolean,
  ): Promise<Tokens> {
    const accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m");
    const refreshExpiresIn = remember
      ? this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d")
      : "1d";
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        {
          sub: customer.id.toString(),
          kind: "customer",
          type: "access",
        },
        {
          secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
          expiresIn: accessExpiresIn as never,
        },
      ),
      this.jwt.signAsync(
        {
          sub: customer.id.toString(),
          kind: "customer",
          type: "refresh",
          family,
          jti: randomUUID(),
        },
        {
          secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
          expiresIn: refreshExpiresIn as never,
        },
      ),
    ]);
    const decoded = this.jwt.decode<CustomerPayload>(refreshToken);

    if (!decoded?.exp) throw new Error("Missing token expiry");

    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      refreshExpiresAt: new Date(decoded.exp * 1000),
    };
  }

  private async verify(
    raw: string,
    type: CustomerPayload["type"],
  ): Promise<CustomerPayload> {
    try {
      const payload = await this.jwt.verifyAsync<CustomerPayload>(raw, {
        secret: this.config.getOrThrow<string>(
          type === "access" ? "JWT_ACCESS_SECRET" : "JWT_REFRESH_SECRET",
        ),
      });

      if (payload.kind !== "customer" || payload.type !== type || !/^\d+$/.test(payload.sub)) {
        throw new Error("invalid");
      }

      return payload;
    } catch {
      throw new UnauthorizedException("令牌无效或已过期。");
    }
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private async recordFailedLogin(customer: Customer): Promise<void> {
    const maxAttempts = this.config.get<number>("LOGIN_MAX_ATTEMPTS", 5);
    const lockMinutes = this.config.get<number>("LOGIN_LOCK_MINUTES", 15);
    await this.prisma.$transaction(async (transaction) => {
      const now = new Date();
      await transaction.customer.updateMany({
        where: {
          id: customer.id,
          passwordHash: customer.passwordHash,
          status: CustomerStatus.ACTIVE,
          deletedAt: null,
          lockedUntil: { lte: now },
        },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      const updated = await transaction.customer.updateMany({
        where: {
          id: customer.id,
          passwordHash: customer.passwordHash,
          status: CustomerStatus.ACTIVE,
          deletedAt: null,
          lockedUntil: null,
        },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      if (updated.count !== 1) return;
      const current = await transaction.customer.findUnique({
        where: { id: customer.id },
        select: { failedLoginAttempts: true },
      });
      if (current && current.failedLoginAttempts >= maxAttempts) {
        await transaction.customer.updateMany({
          where: { id: customer.id, status: CustomerStatus.ACTIVE, deletedAt: null },
          data: { lockedUntil: new Date(now.getTime() + lockMinutes * 60_000) },
        });
      }
    });
  }

  private family(token: string): string {
    const payload = this.jwt.decode<CustomerPayload>(token);
    return payload?.family || randomUUID();
  }

  private phone(value: string): string {
    return value.trim().replace(/[()\s.-]/g, "");
  }
}
