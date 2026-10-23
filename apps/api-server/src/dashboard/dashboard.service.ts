import { BadRequestException, Injectable } from '@nestjs/common';
import { ContentStatus, InquiryStatus, VehicleSaleStatus, VehicleType } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DashboardQueryDto } from './dashboard-query.dto';

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 64;
const MAX_PERIOD_MS = 366 * 86_400_000;

interface CachedDashboard {
  expiresAt: number;
  value: Record<string, unknown>;
}

interface DailyCountRow {
  date: string;
  count: bigint;
}

@Injectable()
export class DashboardService {
  private readonly cache = new Map<string, CachedDashboard>();
  private readonly inFlight = new Map<string, Promise<Record<string, unknown>>>();

  constructor(private readonly prisma: PrismaService) {}

  async get(query: DashboardQueryDto): Promise<Record<string, unknown>> {
    const { from, to } = this.period(query);
    const key = `${from.toISOString()}:${to.toISOString()}`;
    const now = Date.now();
    this.removeExpiredCacheEntries(now);

    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.value;
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const load = this.load(from, to);
    this.inFlight.set(key, load);
    try {
      const value = await load;
      this.storeCacheEntry(key, value, Date.now() + CACHE_TTL_MS);
      return value;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async load(from: Date, to: Date): Promise<Record<string, unknown>> {
    const today = this.startOfUtcDay(new Date());
    const week = new Date(today);
    week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const [
      vehicleTotal,
      vehicleAvailable,
      vehicleSold,
      vehicleDraft,
      vehicleNew,
      vehicleUsed,
      inquiryToday,
      inquiryWeek,
      inquiryMonth,
      inquiryUnhandled,
      images,
      videos,
      inquiryTrendRows,
      vehicleTrendRows,
      recentLogins,
      recentAudits,
      topVehicles,
    ] = await Promise.all([
      this.prisma.vehicle.count({ where: { deletedAt: null } }),
      this.prisma.vehicle.count({
        where: { deletedAt: null, saleStatus: VehicleSaleStatus.AVAILABLE },
      }),
      this.prisma.vehicle.count({
        where: { deletedAt: null, saleStatus: VehicleSaleStatus.SOLD },
      }),
      this.prisma.vehicle.count({
        where: { deletedAt: null, status: ContentStatus.DRAFT },
      }),
      this.prisma.vehicle.count({ where: { deletedAt: null, type: VehicleType.NEW } }),
      this.prisma.vehicle.count({ where: { deletedAt: null, type: VehicleType.USED } }),
      this.prisma.inquiry.count({
        where: { deletedAt: null, createdAt: { gte: today } },
      }),
      this.prisma.inquiry.count({
        where: { deletedAt: null, createdAt: { gte: week } },
      }),
      this.prisma.inquiry.count({
        where: { deletedAt: null, createdAt: { gte: month } },
      }),
      this.prisma.inquiry.count({
        where: { deletedAt: null, status: InquiryStatus.NEW },
      }),
      this.prisma.mediaAsset.count({
        where: { deletedAt: null, mimeType: { startsWith: 'image/' } },
      }),
      this.prisma.mediaAsset.count({
        where: { deletedAt: null, mimeType: { startsWith: 'video/' } },
      }),
      this.inquiryTrendRows(from, to),
      this.vehicleTrendRows(from, to),
      this.prisma.loginLog.findMany({
        include: { adminUser: { select: { username: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.auditLog.findMany({
        include: { adminUser: { select: { username: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.vehicle.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          stockNo: true,
          nameZh: true,
          nameEn: true,
          slug: true,
          _count: { select: { inquiries: true } },
        },
        orderBy: { inquiries: { _count: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      period: { from, to },
      summary: {
        vehicleTotal,
        vehicleAvailable,
        vehicleSold,
        vehicleDraft,
        vehicleNew,
        vehicleUsed,
        inquiryToday,
        inquiryWeek,
        inquiryMonth,
        inquiryUnhandled,
        images,
        videos,
      },
      inquiryTrend: this.trend(from, to, inquiryTrendRows),
      vehicleTrend: this.trend(from, to, vehicleTrendRows),
      recentLogins,
      recentAudits,
      topVehicles,
    };
  }

  private inquiryTrendRows(from: Date, to: Date): Promise<DailyCountRow[]> {
    return this.prisma.$queryRaw<DailyCountRow[]>`
      SELECT DATE_FORMAT(\`createdAt\`, '%Y-%m-%d') AS \`date\`, COUNT(*) AS \`count\`
      FROM \`inquiries\`
      WHERE \`deletedAt\` IS NULL AND \`createdAt\` >= ${from} AND \`createdAt\` <= ${to}
      GROUP BY DATE_FORMAT(\`createdAt\`, '%Y-%m-%d')
      ORDER BY DATE_FORMAT(\`createdAt\`, '%Y-%m-%d')
    `;
  }

  private vehicleTrendRows(from: Date, to: Date): Promise<DailyCountRow[]> {
    return this.prisma.$queryRaw<DailyCountRow[]>`
      SELECT DATE_FORMAT(\`publishedAt\`, '%Y-%m-%d') AS \`date\`, COUNT(*) AS \`count\`
      FROM \`vehicles\`
      WHERE \`deletedAt\` IS NULL AND \`publishedAt\` >= ${from} AND \`publishedAt\` <= ${to}
      GROUP BY DATE_FORMAT(\`publishedAt\`, '%Y-%m-%d')
      ORDER BY DATE_FORMAT(\`publishedAt\`, '%Y-%m-%d')
    `;
  }

  private period(query: DashboardQueryDto): { from: Date; to: Date } {
    let from: Date;
    let to: Date;

    if (query.range === 'custom') {
      if (!query.from || !query.to) {
        throw new BadRequestException('自定义时间需要同时提供开始和结束日期');
      }
      from = new Date(query.from);
      to = new Date(query.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) to = this.endOfUtcDay(to);
    } else {
      to = query.to ? new Date(query.to) : new Date();
      from = new Date(to);
      from.setUTCDate(from.getUTCDate() - Number(query.range) + 1);
    }

    from = this.startOfUtcDay(from);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('统计日期格式不正确');
    }
    if (from > to) throw new BadRequestException('开始时间不能晚于结束时间');
    if (to.getTime() - from.getTime() > MAX_PERIOD_MS) {
      throw new BadRequestException('统计时间范围不能超过 366 天');
    }
    return { from, to };
  }

  private trend(
    from: Date,
    to: Date,
    rows: DailyCountRow[],
  ): Array<{ date: string; count: number }> {
    const counts = new Map(rows.map(({ date, count }) => [date, Number(count)]));
    const result: Array<{ date: string; count: number }> = [];
    const cursor = new Date(from);

    while (cursor <= to) {
      const date = this.utcDateKey(cursor);
      result.push({ date, count: counts.get(date) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return result;
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private endOfUtcDay(value: Date): Date {
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }

  private utcDateKey(value: Date): string {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private removeExpiredCacheEntries(now: number): void {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }

  private storeCacheEntry(
    key: string,
    value: Record<string, unknown>,
    expiresAt: number,
  ): void {
    this.cache.delete(key);
    this.cache.set(key, { value, expiresAt });

    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) return;
      this.cache.delete(oldestKey);
    }
  }
}
