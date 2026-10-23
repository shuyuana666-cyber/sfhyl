import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Customer } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { RequestMeta } from "../common/utils/request-meta";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import { CustomerAuthService } from "./customer-auth.service";

const meta: RequestMeta = {
  ipAddress: "127.0.0.1",
  userAgent: "test",
  requestId: "test-request",
  method: "POST",
  path: "/public/auth/login",
  durationMs: 0,
};

function config(): ConfigService {
  return {
    get: (key: string, fallback: unknown) =>
      key === "LOGIN_MAX_ATTEMPTS" ? 2 : fallback,
    getOrThrow: () => "test-secret-at-least-thirty-two-characters",
  } as unknown as ConfigService;
}

describe("CustomerAuthService", () => {
  it("generates distinct refresh tokens even within one second", async () => {
    const jwt = new JwtService();
    const service = new CustomerAuthService({} as PrismaService, jwt, config());
    const customer = { id: 7n } as Customer;

    const first = await service["tokens"](customer, meta, "same-family", null, true);
    const second = await service["tokens"](customer, meta, "same-family", null, true);

    expect(first.refreshToken).not.toBe(second.refreshToken);
    expect(jwt.decode(first.refreshToken)).toMatchObject({ family: "same-family" });
  });

  it("locks a customer after the configured number of bad passwords", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const customer = {
      id: 7n,
      status: "ACTIVE",
      passwordHash,
      deletedAt: null,
      lockedUntil: null,
    } as Customer;
    let attempts = 0;
    const updateMany = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if ("failedLoginAttempts" in data && typeof data.failedLoginAttempts === "object") {
        attempts += 1;
        return { count: 1 };
      }
      return { count: 0 };
    });
    const transaction = {
      customer: {
        updateMany,
        findUnique: async () => ({ failedLoginAttempts: attempts }),
      },
    };
    const prisma = {
      customer: { findFirst: async () => customer },
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaService;
    const service = new CustomerAuthService(prisma, new JwtService(), config());
    const login = () => service.login({ identifier: "customer@example.com", password: "wrong-password", remember: false }, meta);

    await expect(login()).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(login()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(attempts).toBe(2);
    const lockCall = updateMany.mock.calls.find(([options]) =>
      options.data.lockedUntil instanceof Date,
    );
    expect(lockCall).toBeDefined();
  });
});
