import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ContentStatus, MediaAssetStatus, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AuditService } from "../audit/audit.service";
import { PublicCacheService } from "../infrastructure/cache/public-cache.service";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { StorageProvider } from "../infrastructure/storage/storage-provider";
import {
  buildManagedHomepageContent,
  homepageDefaultAssets,
  isManagedHomepageContent,
  type HomepageDefaultAsset,
  type HomepageDefaultAssetIds,
} from "./homepage-default-content";
import {
  isCompanyOverviewSeeded,
  seedCompanyOverviewContent,
} from "./homepage-company-overview";
import { upgradeServiceModuleBodies } from "./homepage-service-content";

const HOMEPAGE_SLUG = "homepage-content";
const SOURCE_PATH = "/system/homepage-default-import";
type HomepageContentPage = { id: bigint; content: unknown };

function containsMediaReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => containsMediaReference(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
    key.endsWith("MediaId")
      ? item !== null && item !== ""
      : containsMediaReference(item),
  );
}

export function needsHomepageDefaultImport(content: unknown): boolean {
  return !isManagedHomepageContent(content) && !containsMediaReference(content);
}

@Injectable()
export class HomepageDefaultImporterService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HomepageDefaultImporterService.name);
  private importing: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly cache: PublicCacheService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensure();
  }

  async ensure(): Promise<void> {
    if (this.importing) return this.importing;
    this.importing = this.ensureInternal().finally(() => {
      this.importing = null;
    });
    return this.importing;
  }

  private async ensureInternal(): Promise<void> {
    const existingPage = await this.prisma.page.findUnique({
      where: { slug: HOMEPAGE_SLUG },
      select: { id: true, content: true },
    });
    let page: HomepageContentPage | null = existingPage;
    if (needsHomepageDefaultImport(existingPage?.content)) {
      page = await this.importLegacyDefaults();
    }
    if (page) {
      page = await this.seedCompanyOverview(page);
      await this.seedServiceModules(page);
    }
  }

  private async importLegacyDefaults(): Promise<HomepageContentPage | null> {
    const sourceDirectory = this.config.get<string>(
      "HOMEPAGE_DEFAULT_ASSETS_DIR",
      "",
    );
    if (!sourceDirectory) return null;

    try {
      const files = await Promise.all(
        homepageDefaultAssets.map(async (asset) => ({
          ...asset,
          content: await readFile(join(sourceDirectory, asset.filename)),
        })),
      );
      const mediaIds = {} as HomepageDefaultAssetIds;
      for (const file of files) {
        const asset = await this.ensureAsset(file);
        mediaIds[file.key] = asset.id.toString();
      }

      const content = seedCompanyOverviewContent(
        buildManagedHomepageContent(mediaIds),
      ) as Prisma.InputJsonValue;
      const page = await this.prisma.page.upsert({
        where: { slug: HOMEPAGE_SLUG },
        create: {
          slug: HOMEPAGE_SLUG,
          titleZh: "首页内容",
          titleEn: "Homepage content",
          content,
          status: ContentStatus.PUBLISHED,
          publishedAt: new Date(),
        },
        update: {
          content,
          status: ContentStatus.PUBLISHED,
          publishedAt: new Date(),
          deletedAt: null,
        },
      });
      await this.audit.record({
        actorId: null,
        action: "import_defaults",
        resourceType: "homepage_content",
        resourceId: page.id,
        summary: "Imported the legacy homepage defaults into the media library.",
        afterData: page,
        meta: {
          ipAddress: null,
          userAgent: "homepage-default-importer",
          requestId: "homepage-default-import",
          method: "SYSTEM",
          path: SOURCE_PATH,
          durationMs: 0,
        },
      });
      await this.cache.invalidateAll();
      this.logger.log("Imported the legacy homepage defaults into managed content.");
      return { id: page.id, content };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Homepage default import skipped: ${message}`);
      return null;
    }
  }

  private async seedCompanyOverview(page: HomepageContentPage): Promise<HomepageContentPage> {
    if (isCompanyOverviewSeeded(page.content)) return page;
    const content = seedCompanyOverviewContent(page.content) as Prisma.InputJsonValue;
    const updated = await this.prisma.page.update({
      where: { id: page.id },
      data: { content },
    });
    await this.audit.record({
      actorId: null,
      action: "seed_company_overview",
      resourceType: "homepage_content",
      resourceId: page.id,
      summary: "Seeded the editable company overview homepage module.",
      beforeData: page,
      afterData: updated,
      meta: {
        ipAddress: null,
        userAgent: "homepage-default-importer",
        requestId: "homepage-company-overview-seed",
        method: "SYSTEM",
        path: SOURCE_PATH,
        durationMs: 0,
      },
    });
    await this.cache.invalidateAll();
    this.logger.log("Seeded the editable company overview homepage module.");
    return { id: updated.id, content };
  }

  private async seedServiceModules(page: HomepageContentPage): Promise<void> {
    const { content, changed } = upgradeServiceModuleBodies(page.content);
    if (!changed) return;
    const updated = await this.prisma.page.update({
      where: { id: page.id },
      data: { content: content as Prisma.InputJsonValue },
    });
    await this.audit.record({
      actorId: null,
      action: "refresh_service_modules",
      resourceType: "homepage_content",
      resourceId: page.id,
      summary: "Expanded unedited homepage service modules while preserving custom content.",
      beforeData: page,
      afterData: updated,
      meta: {
        ipAddress: null,
        userAgent: "homepage-default-importer",
        requestId: "homepage-service-content-refresh",
        method: "SYSTEM",
        path: SOURCE_PATH,
        durationMs: 0,
      },
    });
    await this.cache.invalidateAll();
    this.logger.log("Expanded the default homepage service modules.");
  }

  private async ensureAsset(
    file: HomepageDefaultAsset & { content: Buffer },
  ): Promise<{ id: bigint }> {
    const objectKey = `system/homepage-defaults/v1/${file.filename}`;
    const existing = await this.prisma.mediaAsset.findFirst({
      where: { driver: this.storage.driver, objectKey },
      select: { id: true, status: true, deletedAt: true },
    });
    if (existing) {
      if (
        existing.status !== MediaAssetStatus.ACTIVE ||
        existing.deletedAt !== null
      ) {
        return this.prisma.mediaAsset.update({
          where: { id: existing.id },
          data: { status: MediaAssetStatus.ACTIVE, deletedAt: null },
          select: { id: true },
        });
      }
      return { id: existing.id };
    }

    const stored = await this.storage.putObject({
      objectKey,
      content: file.content,
      mimeType: file.mimeType,
    });
    const extension = file.filename.split(".").pop() || null;
    return this.prisma.mediaAsset.create({
      data: {
        driver: stored.driver,
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        url: stored.url,
        webpObjectKey:
          file.mimeType === "image/webp" ? stored.objectKey : null,
        webpUrl: file.mimeType === "image/webp" ? stored.url : null,
        originalName: file.filename,
        filename: file.filename,
        extension,
        mimeType: file.mimeType,
        sizeBytes: BigInt(file.content.length),
        checksum: createHash("sha256").update(file.content).digest("hex"),
        status: MediaAssetStatus.ACTIVE,
      },
      select: { id: true },
    });
  }
}
