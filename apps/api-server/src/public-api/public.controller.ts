import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ContentStatus } from "@prisma/client";
import { Public } from "../common/decorators/public.decorator";
import { HomepageService } from "../homepage/homepage.service";
import { HomepageContentService } from "../content/homepage-content.service";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { PublicCacheService } from "../infrastructure/cache/public-cache.service";
import { SettingsService } from "../settings/settings.service";
import { PublicVehicleQueryDto } from "../vehicles/dto/vehicle-query.dto";
import { PublicVehiclesService } from "../vehicles/public-vehicles.service";
import { ExchangeRatesService } from "./exchange-rates.service";

interface NavigationNode {
  id: bigint;
  parentId: bigint | null;
  key: string;
  labelZh: string;
  labelEn: string;
  labelRu: string | null;
  href: string;
  target: string;
  icon: string | null;
  sortOrder: number;
  children: NavigationNode[];
}

@ApiTags("public")
@Public()
@Controller("public")
export class PublicController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly homepage: HomepageService,
    private readonly vehicles: PublicVehiclesService,
    private readonly cache: PublicCacheService,
    private readonly homepageContent: HomepageContentService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  @Get("exchange-rates")
  exchangeRatesPublic(): Promise<unknown> {
    return this.exchangeRates.get();
  }

  @Get("site")
  async site(): Promise<Record<string, unknown>> {
    return this.cache.remember(
      "site",
      async () => {
        const [settings, navigation] = await Promise.all([
          this.settings.publicSettings(),
          this.prisma.navigationItem.findMany({
            where: { isEnabled: true, deletedAt: null, key: { not: "about" } },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          }),
        ]);
        const nodes = navigation.map((item) => ({
          ...item,
          children: [],
        })) as NavigationNode[];
        const byId = new Map(nodes.map((item) => [item.id.toString(), item]));
        const roots: NavigationNode[] = [];
        for (const item of nodes) {
          const parent = item.parentId
            ? byId.get(item.parentId.toString())
            : undefined;
          if (parent) parent.children.push(item);
          else roots.push(item);
        }
        return { settings, navigation: roots };
      },
      300,
    );
  }

  @Get("home")
  home(): Promise<Record<string, unknown>> {
    return this.cache.remember("home", () => this.homepage.publicHome(), 60);
  }

  @Get("homepage-content")
  homepageContentPublic(): Promise<unknown> {
    return this.cache.remember("homepage-content", () => this.homepageContent.public(), 60);
  }

  @Get("banners")
  banners(): Promise<unknown> {
    return this.cache.remember(
      "banners",
      () => this.homepage.publicBanners(),
      60,
    );
  }

  @Get("pages/:slug")
  async page(@Param("slug") slug: string): Promise<unknown> {
    return this.cache.remember(
      `page:${this.cache.fingerprint(slug)}`,
      async () => {
        const page = await this.prisma.page.findFirst({
          where: { slug, status: ContentStatus.PUBLISHED, deletedAt: null },
          include: { ogMedia: true },
        });
        if (!page) throw new NotFoundException("页面不存在");
        return page;
      },
      300,
    );
  }

  @Get("brands")
  brands(): Promise<unknown> {
    return this.cache.remember(
      "brands",
      () =>
        this.prisma.brand.findMany({
          where: { isEnabled: true, deletedAt: null },
          select: {
            id: true,
            nameZh: true,
            nameEn: true,
            nameRu: true,
            slug: true,
            country: true,
            descriptionZh: true,
            descriptionEn: true,
            descriptionRu: true,
            logoMedia: true,
            series: {
              where: { isEnabled: true, deletedAt: null },
              select: {
                id: true,
                nameZh: true,
                nameEn: true,
                nameRu: true,
                slug: true,
              },
              orderBy: { sortOrder: "asc" },
            },
            _count: {
              select: {
                vehicles: {
                  where: { status: ContentStatus.PUBLISHED, deletedAt: null },
                },
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
        }),
      300,
    );
  }

  @Get("vehicles")
  vehiclesList(@Query() query: PublicVehicleQueryDto): Promise<unknown> {
    const key = `vehicles:list:${this.cache.fingerprint(query)}`;
    return this.cache.remember(key, () => this.vehicles.list(query), 60);
  }

  @Get("vehicles/:slug")
  vehicle(@Param("slug") slug: string): Promise<unknown> {
    const key = `vehicles:detail:${this.cache.fingerprint(slug)}`;
    return this.cache.remember(
      key,
      () => this.vehicles.detail(slug),
      120,
    );
  }
}
