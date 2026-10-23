import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ContentStatus,
  Currency,
  MediaAssetStatus,
  MileageUnit,
  VehicleMediaType,
  VehicleSaleStatus,
  VehicleType,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AuditService } from "../audit/audit.service";
import { PublicCacheService } from "../infrastructure/cache/public-cache.service";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { StorageProvider } from "../infrastructure/storage/storage-provider";
import { legacyVehicleDefaults, type LegacyVehicleDefault } from "./legacy-vehicle-defaults";

const MARKER_GROUP = "system";
const MARKER_KEY = "legacy_vehicle_import_v1";
const FOLDER_SLUG = "legacy-vehicles-v1";
const SOURCE_PATH = "/system/legacy-vehicle-import";

@Injectable()
export class LegacyVehicleImporterService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LegacyVehicleImporterService.name);
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
    const marker = await this.prisma.siteSetting.findUnique({
      where: { group_key: { group: MARKER_GROUP, key: MARKER_KEY } },
      select: { id: true, value: true },
    });
    if (marker && this.isCompletedMarker(marker.value)) return;

    const sourceDirectory = this.config.get<string>(
      "LEGACY_VEHICLE_ASSETS_DIR",
      "",
    );
    if (!sourceDirectory) return;

    try {
      const folder = await this.ensureFolder();
      const brandIds = new Map<string, bigint>();
      for (const [index, vehicle] of legacyVehicleDefaults.entries()) {
        const brandId = await this.ensureBrand(vehicle.brand, index, brandIds);
        const asset = await this.ensureAsset(
          vehicle,
          folder.id,
          sourceDirectory,
        );
        await this.ensureVehicle(vehicle, brandId, asset.id, index);
      }
      await this.mark("completed", legacyVehicleDefaults.length);
      await this.audit.record({
        actorId: null,
        action: "import_defaults",
        resourceType: "vehicle",
        summary: `Imported ${legacyVehicleDefaults.length} legacy website vehicles.`,
        meta: {
          ipAddress: null,
          userAgent: "legacy-vehicle-importer",
          requestId: "legacy-vehicle-import",
          method: "SYSTEM",
          path: SOURCE_PATH,
          durationMs: 0,
        },
      });
      await this.cache.invalidateAll();
      this.logger.log(`Imported ${legacyVehicleDefaults.length} legacy vehicles.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Legacy vehicle import skipped: ${message}`);
    }
  }

  private async ensureFolder(): Promise<{ id: bigint }> {
    const existing = await this.prisma.mediaFolder.findFirst({
      where: { parentId: null, slug: FOLDER_SLUG },
      select: { id: true, deletedAt: true },
    });
    if (existing) {
      if (existing.deletedAt) {
        return this.prisma.mediaFolder.update({
          where: { id: existing.id },
          data: { deletedAt: null },
          select: { id: true },
        });
      }
      return { id: existing.id };
    }
    return this.prisma.mediaFolder.create({
      data: {
        name: "官网原有车辆",
        slug: FOLDER_SLUG,
      },
      select: { id: true },
    });
  }

  private async ensureBrand(
    name: string,
    index: number,
    ids: Map<string, bigint>,
  ): Promise<bigint> {
    const known = ids.get(name);
    if (known) return known;
    const slug = name.toLowerCase();
    const brand = await this.prisma.brand.upsert({
      where: { slug },
      update: {
        nameZh: name,
        nameEn: name,
        nameRu: name,
        isEnabled: true,
        deletedAt: null,
      },
      create: {
        nameZh: name,
        nameEn: name,
        nameRu: name,
        slug,
        sortOrder: index,
      },
      select: { id: true },
    });
    ids.set(name, brand.id);
    return brand.id;
  }

  private async ensureAsset(
    vehicle: LegacyVehicleDefault,
    folderId: bigint,
    sourceDirectory: string,
  ): Promise<{ id: bigint }> {
    const objectKey = `system/legacy-vehicles/v1/${vehicle.filename}`;
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
          data: {
            folderId,
            status: MediaAssetStatus.ACTIVE,
            deletedAt: null,
          },
          select: { id: true },
        });
      }
      return { id: existing.id };
    }

    const content = await readFile(join(sourceDirectory, vehicle.filename));
    const stored = await this.storage.putObject({
      objectKey,
      content,
      mimeType: "image/jpeg",
    });
    return this.prisma.mediaAsset.create({
      data: {
        folderId,
        driver: stored.driver,
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        url: stored.url,
        originalName: vehicle.filename,
        filename: vehicle.filename,
        extension: "jpg",
        mimeType: "image/jpeg",
        sizeBytes: BigInt(content.length),
        checksum: createHash("sha256").update(content).digest("hex"),
        status: MediaAssetStatus.ACTIVE,
      },
      select: { id: true },
    });
  }

  private async ensureVehicle(
    vehicle: LegacyVehicleDefault,
    brandId: bigint,
    mediaId: bigint,
    sortOrder: number,
  ): Promise<void> {
    const created = await this.prisma.vehicle.upsert({
      where: { legacyId: vehicle.legacyId },
      update: {},
      create: {
        legacyId: vehicle.legacyId,
        stockNo: vehicle.legacyId,
        type: VehicleType.USED,
        nameZh: vehicle.titleZh,
        nameEn: vehicle.titleEn,
        nameRu: vehicle.titleRu,
        slug: vehicle.legacyId,
        brandId,
        year: vehicle.year,
        price: vehicle.price,
        currency: Currency.CNY,
        priceNote: vehicle.priceNote,
        mileage: vehicle.mileage,
        mileageUnit: MileageUnit.KM,
        shortDescriptionZh: vehicle.titleZh,
        shortDescriptionEn: vehicle.titleEn,
        shortDescriptionRu: vehicle.titleRu,
        status: ContentStatus.PUBLISHED,
        saleStatus: VehicleSaleStatus.AVAILABLE,
        isHomepage: true,
        sortOrder,
        publishedAt: new Date(),
        coverMediaId: mediaId,
      },
      select: { id: true, coverMediaId: true },
    });
    const existingMedia = await this.prisma.vehicleMedia.findFirst({
      where: { vehicleId: created.id, mediaId },
      select: { id: true },
    });
    if (!existingMedia) {
      await this.prisma.vehicleMedia.create({
        data: {
          vehicleId: created.id,
          mediaId,
          type: VehicleMediaType.GALLERY,
          sortOrder: 0,
          isCover: true,
        },
      });
    }
    if (!created.coverMediaId) {
      await this.prisma.vehicle.update({
        where: { id: created.id },
        data: { coverMediaId: mediaId },
      });
    }
  }

  private isCompletedMarker(value: unknown): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).state === "completed"
    );
  }

  private mark(state: "completed", vehicleCount: number): Promise<unknown> {
    return this.prisma.siteSetting.upsert({
      where: { group_key: { group: MARKER_GROUP, key: MARKER_KEY } },
      update: { value: { state, vehicleCount, completedAt: new Date().toISOString() } },
      create: {
        group: MARKER_GROUP,
        key: MARKER_KEY,
        value: { state, vehicleCount, completedAt: new Date().toISOString() },
        description: "Legacy website vehicle import marker.",
        isPublic: false,
        isSensitive: false,
      },
    });
  }
}
