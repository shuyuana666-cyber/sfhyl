import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prismaConstraintTarget } from "../common/utils/prisma-constraint.util";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { CreateVehicleDto } from "./dto/create-vehicle.dto";

export class VehicleIdentityManager {
  constructor(private readonly prisma: PrismaService) {}

  slugBase(dto: CreateVehicleDto): string {
    const source =
      dto.slug?.trim() ||
      dto.nameEn?.trim() ||
      dto.nameZh.trim() ||
      dto.stockNo?.trim() ||
      "";
    const slug = source
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 191);
    if (slug) return slug;
    const seed = `${dto.nameZh}:${dto.nameEn ?? ""}:${dto.stockNo ?? ""}`;
    return `vehicle-${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
  }

  async nextSlug(base: string): Promise<string> {
    for (let index = 1; index <= 10_000; index += 1) {
      const suffix = index === 1 ? "" : `-${index}`;
      const slug = `${base.slice(0, 191 - suffix.length)}${suffix}`;
      const existing = await this.prisma.vehicle.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) return slug;
    }
    throw new ConflictException("车辆链接标识已达到可用上限");
  }

  isSlugConflict(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      return false;
    }
    const value = prismaConstraintTarget(error.meta?.target);
    return value.toLowerCase().includes("slug");
  }

  isStockNoConflict(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      return false;
    }
    const value = prismaConstraintTarget(error.meta?.target);
    return value.toLowerCase().includes("stockno");
  }

  async nextGeneratedStockNo(): Promise<string> {
    const date = this.shanghaiDate();
    const prefix = `${date}-`;
    const rows = await this.prisma.vehicle.findMany({
      where: { stockNo: { startsWith: prefix } },
      select: { stockNo: true },
    });
    const next =
      rows.reduce((highest, row) => {
        const match = new RegExp(`^${prefix}(\\d+)$`).exec(row.stockNo);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0) + 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }

  private shanghaiDate(): string {
    const values = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: string) =>
      values.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}${part("month")}${part("day")}`;
  }
}
