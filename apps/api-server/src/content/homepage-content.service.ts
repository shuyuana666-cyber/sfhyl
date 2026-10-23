import { BadRequestException, Injectable } from "@nestjs/common";
import { ContentStatus, MediaAssetStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta";
import { PublicCacheService } from "../infrastructure/cache/public-cache.service";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { HomepageDefaultImporterService } from "./homepage-default-importer.service";
import { homepageMediaIds } from "./homepage-content-utils";
import { sanitizeRichText } from "../common/security/sanitize-rich-text";

const SLUG = "homepage-content";

type JsonObject = Record<string, unknown>;
type LocalizedText = { zh: string; en: string; ru: string };
type CustomModuleMediaType = "NONE" | "IMAGE" | "VIDEO";
type CustomModulePlacement =
  | "BEFORE_ABOUT"
  | "AFTER_VIDEOS"
  | "HOME_AFTER_FEATURES"
  | "ABOUT_AFTER_INTRO";
type CustomModuleDisplayScope = "HOME" | "ABOUT" | "BOTH";

const localized = (zh: string, en: string, ru: string): LocalizedText => ({
  zh,
  en,
  ru,
});

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback: LocalizedText): LocalizedText {
  const source = object(value);
  return {
    zh: typeof source.zh === "string" ? source.zh : fallback.zh,
    en: typeof source.en === "string" ? source.en : fallback.en,
    ru: typeof source.ru === "string" ? source.ru : fallback.ru,
  };
}

function richText(value: unknown): LocalizedText {
  const source = text(value, localized("", "", ""));
  return {
    zh: sanitizeRichText(source.zh) || "",
    en: sanitizeRichText(source.en) || "",
    ru: sanitizeRichText(source.ru) || "",
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function customModuleMediaType(value: unknown): CustomModuleMediaType {
  return value === "IMAGE" || value === "VIDEO" ? value : "NONE";
}

function customModulePlacement(value: unknown): CustomModulePlacement {
  return value === "BEFORE_ABOUT"
    || value === "HOME_AFTER_FEATURES"
    || value === "ABOUT_AFTER_INTRO"
    || value === "AFTER_VIDEOS"
    ? value
    : "AFTER_VIDEOS";
}

function customModuleDisplayScope(value: unknown): CustomModuleDisplayScope {
  return value === "HOME" || value === "ABOUT" ? value : "BOTH";
}

function customModuleId(value: unknown, index: number, used: Set<string>): string {
  const candidate = stringValue(value).trim();
  const base = /^[A-Za-z0-9_-]{1,96}$/.test(candidate)
    ? candidate
    : `custom-${index + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

const aboutTitle = localized("关于我们", "About us", "О нас");
const transportTitle = localized(
  "运输与交付",
  "Transportation and delivery",
  "Перевозка и доставка",
);
const staffTitle = localized("员工风采", "Our team", "Наша команда");
const videosTitle = localized("视频", "Video", "Видео");
const quickNavTitle = localized(
  "快捷导航",
  "Quick navigation",
  "Быстрая навигация",
);
const locationsTitle = localized(
  "办公室与停车场",
  "Offices and parking yards",
  "Офисы и стоянки",
);

export const defaultHomepageContent = (): JsonObject => ({
  managed: true,
  schemaVersion: 5,
  companyOverviewSeeded: false,
  companyOverviewLayoutVersion: 0,
  companyOverviewBodyFormatVersion: 0,
  heroEnabled: true,
  hero: [],
  about: {
    enabled: true,
    title: aboutTitle,
    body: localized("", "", ""),
    button: {
      label: localized("了解更多", "Learn more", "Подробнее"),
      href: "#about",
    },
    videoMediaId: null,
    posterMediaId: null,
  },
  transport: { enabled: true, title: transportTitle, items: [] },
  staff: { enabled: true, title: staffTitle, items: [] },
  videos: { enabled: true, title: videosTitle, items: [] },
  quickNav: { enabled: true, title: quickNavTitle, items: [] },
  locations: { enabled: true, title: locationsTitle, items: [] },
  customModules: [],
});

export function normalizeHomepageContent(value: unknown): JsonObject {
  const source = object(value);
  const about = object(source.about);
  const transport = object(source.transport);
  const staff = object(source.staff);
  const videos = object(source.videos);
  const quickNav = object(source.quickNav);
  const locations = object(source.locations);
  const button = object(about.button);
  const customIds = new Set<string>();

  return {
    managed: source.managed !== false,
    schemaVersion: 5,
    companyOverviewSeeded: source.companyOverviewSeeded === true,
    companyOverviewLayoutVersion:
      Number(source.companyOverviewLayoutVersion) >= 2 ? 2 : 0,
    companyOverviewBodyFormatVersion:
      Number(source.companyOverviewBodyFormatVersion) >= 1 ? 1 : 0,
    heroEnabled: source.heroEnabled !== false,
    hero: array(source.hero).map(item => {
      const sourceItem = object(item);
      return {
        imageMediaId: stringOrNull(sourceItem.imageMediaId),
        mobileMediaId: stringOrNull(sourceItem.mobileMediaId),
        title: text(sourceItem.title, localized("", "", "")),
        enabled: sourceItem.enabled !== false,
      };
    }),
    about: {
      enabled: about.enabled !== false,
      title: text(about.title, aboutTitle),
      body: richText(about.body),
      button: {
        label: text(button.label, localized("了解更多", "Learn more", "Подробнее")),
        href: stringValue(button.href, "#about"),
      },
      videoMediaId: stringOrNull(about.videoMediaId),
      posterMediaId: stringOrNull(about.posterMediaId),
    },
    transport: {
      enabled: transport.enabled !== false,
      title: text(transport.title, transportTitle),
      items: array(transport.items).map(item => {
        const sourceItem = object(item);
        return {
          imageMediaId: stringOrNull(sourceItem.imageMediaId),
          title: text(sourceItem.title, localized("", "", "")),
          description: text(sourceItem.description, localized("", "", "")),
        };
      }),
    },
    staff: {
      enabled: staff.enabled !== false,
      title: text(staff.title, staffTitle),
      items: array(staff.items).map(item => {
        const sourceItem = object(item);
        return {
          imageMediaId: stringOrNull(sourceItem.imageMediaId),
          name: text(sourceItem.name, localized("", "", "")),
          role: text(sourceItem.role, localized("", "", "")),
          description: text(sourceItem.description, localized("", "", "")),
        };
      }),
    },
    videos: {
      enabled: videos.enabled !== false,
      title: text(videos.title, videosTitle),
      items: array(videos.items).map(item => {
        const sourceItem = object(item);
        return {
          videoMediaId: stringOrNull(sourceItem.videoMediaId),
          posterMediaId: stringOrNull(sourceItem.posterMediaId),
          title: text(sourceItem.title, localized("", "", "")),
        };
      }),
    },
    quickNav: {
      enabled: quickNav.enabled !== false,
      title: text(quickNav.title, quickNavTitle),
      items: array(quickNav.items).map(item => {
        const sourceItem = object(item);
        return {
          label: text(sourceItem.label, localized("", "", "")),
          href: stringValue(sourceItem.href, "#about"),
          enabled: sourceItem.enabled !== false,
        };
      }),
    },
    locations: {
      enabled: locations.enabled !== false,
      title: text(locations.title, locationsTitle),
      items: array(locations.items).map(item => {
        const sourceItem = object(item);
        return {
          type: sourceItem.type === "PARKING" ? "PARKING" : "OFFICE",
          name: text(sourceItem.name, localized("", "", "")),
          address: text(sourceItem.address, localized("", "", "")),
          mapUrl: stringValue(sourceItem.mapUrl),
          enabled: sourceItem.enabled !== false,
        };
      }),
    },
    customModules: array(source.customModules).map((item, index) => {
      const sourceItem = object(item);
      const mediaType = customModuleMediaType(sourceItem.mediaType);
      const customButton = object(sourceItem.button);
      return {
        id: customModuleId(sourceItem.id, index, customIds),
        enabled: sourceItem.enabled !== false,
        placement: customModulePlacement(sourceItem.placement),
        displayScope: customModuleDisplayScope(sourceItem.displayScope),
        title: text(sourceItem.title, localized("", "", "")),
        body: richText(sourceItem.body),
        mediaType,
        imageMediaId:
          mediaType === "IMAGE" ? stringOrNull(sourceItem.imageMediaId) : null,
        ...(sourceItem.id === "home-service-process" && Array.isArray(sourceItem.stageImages)
          ? { stageImages: sourceItem.stageImages.slice(0, 20).map(stage => ({ imageMediaId: stringOrNull(object(stage).imageMediaId) })) }
          : {}),
        videoMediaId:
          mediaType === "VIDEO" ? stringOrNull(sourceItem.videoMediaId) : null,
        posterMediaId:
          mediaType === "VIDEO" ? stringOrNull(sourceItem.posterMediaId) : null,
        button: {
          label: text(customButton.label, localized("", "", "")),
          href: stringValue(customButton.href),
        },
      };
    }),
  };
}

@Injectable()
export class HomepageContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: PublicCacheService,
    private readonly defaults: HomepageDefaultImporterService,
  ) {}

  async admin(): Promise<unknown> {
    await this.defaults.ensure();
    const page = await this.prisma.page.findUnique({ where: { slug: SLUG } });
    const content = normalizeHomepageContent(page?.content);
    return {
      ...(page ?? { slug: SLUG, status: ContentStatus.DRAFT }),
      content,
      media: await this.resolveMedia(content),
    };
  }

  async save(content: Record<string, unknown>, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const normalized = normalizeHomepageContent(content);
    await this.validate(normalized);
    const before = await this.prisma.page.findUnique({ where: { slug: SLUG } });
    const page = await this.prisma.page.upsert({
      where: { slug: SLUG },
      create: { slug: SLUG, titleZh: "首页内容", titleEn: "Homepage content", content: normalized as Prisma.InputJsonValue, status: ContentStatus.DRAFT, createdById: actorId, updatedById: actorId },
      update: { content: normalized as Prisma.InputJsonValue, updatedById: actorId },
    });
    await this.audit.record({ actorId, action: "update", resourceType: "homepage_content", resourceId: page.id, beforeData: before, afterData: page, meta });
    await this.cache.invalidateAll();
    return page;
  }

  async publish(actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.page.findUnique({ where: { slug: SLUG } });
    if (!before) throw new BadRequestException("Homepage content has not been saved.");
    const page = await this.prisma.page.update({ where: { slug: SLUG }, data: { status: ContentStatus.PUBLISHED, publishedAt: new Date(), updatedById: actorId } });
    await this.audit.record({ actorId, action: "publish", resourceType: "homepage_content", resourceId: page.id, beforeData: before, afterData: page, meta });
    await this.cache.invalidateAll();
    return page;
  }

  async public(): Promise<unknown> {
    await this.defaults.ensure();
    const page = await this.prisma.page.findFirst({ where: { slug: SLUG, status: ContentStatus.PUBLISHED, deletedAt: null } });
    const content = normalizeHomepageContent(page?.content);
    return { content, media: await this.resolveMedia(content) };
  }

  private async resolveMedia(content: Record<string, unknown>): Promise<Record<string, unknown>> {
    const ids = [...new Set(homepageMediaIds(content))];
    const assets = ids.length
      ? await this.prisma.mediaAsset.findMany({
          where: {
            id: { in: ids },
            status: MediaAssetStatus.ACTIVE,
            deletedAt: null,
          },
        })
      : [];
    return Object.fromEntries(
      assets.map((asset) => [asset.id.toString(), asset]),
    );
  }

  private async validate(content: Record<string, unknown>): Promise<void> {
    if (!content || Array.isArray(content)) throw new BadRequestException("Homepage content must be an object.");
    for (const value of Object.values(content)) this.validateNode(value);
    const ids = [...new Set(homepageMediaIds(content))];
    if (!ids.length) return;
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, status: MediaAssetStatus.ACTIVE, deletedAt: null },
      select: { id: true, mimeType: true },
    });
    if (assets.length !== ids.length) throw new BadRequestException("Homepage content references an unavailable media asset.");
    const assetById = new Map(assets.map((asset) => [asset.id.toString(), asset]));
    for (const module of array(content.customModules)) {
      const item = object(module);
      if (item.mediaType === "IMAGE") {
        this.validateCustomModuleMedia(item.imageMediaId, "image", assetById);
      }
      if (item.id === "home-service-process") {
        for (const stage of array(item.stageImages)) {
          this.validateCustomModuleMedia(object(stage).imageMediaId, "image", assetById);
        }
      }
      if (item.mediaType === "VIDEO") {
        this.validateCustomModuleMedia(item.videoMediaId, "video", assetById);
        this.validateCustomModuleMedia(item.posterMediaId, "image", assetById);
      }
    }
  }

  private validateCustomModuleMedia(
    mediaId: unknown,
    expectedGroup: "image" | "video",
    assets: Map<string, { mimeType: string }>,
  ): void {
    const id = stringOrNull(mediaId);
    if (!id) return;
    if (!assets.get(id)?.mimeType.startsWith(`${expectedGroup}/`)) {
      throw new BadRequestException(
        `Custom module ${expectedGroup} media must reference a ${expectedGroup} asset.`,
      );
    }
  }

  private validateNode(value: unknown): void {
    if (typeof value === "string") {
      if (value.length > 20_000) throw new BadRequestException("Homepage content text is too long.");
      if (/^(https?:)?\/\//i.test(value) && !/^https?:\/\//i.test(value)) throw new BadRequestException("Only absolute HTTP(S) links are allowed.");
      return;
    }
    if (Array.isArray(value)) { value.forEach((item) => this.validateNode(item)); return; }
    if (value && typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (key === "href" || key === "mapUrl") {
        if (typeof item !== "string" || (item && !item.startsWith("/") && !/^https?:\/\//i.test(item) && !item.startsWith("#"))) throw new BadRequestException("Invalid homepage link.");
      } else this.validateNode(item);
    });
  }

}
