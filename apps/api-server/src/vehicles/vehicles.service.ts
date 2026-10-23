import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import {
  ContentStatus,
  Prisma,
  VehicleMediaType,
  VehicleSaleStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { paginated } from "../common/interfaces/api-response";
import type { RequestMeta } from "../common/utils/request-meta";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { TranslationService } from "../translation/translation.service";
import { applyLocalizedFields } from "../translation/localized-fields";
import type {
  CreateVehicleDto,
  UpdateVehicleDto,
} from "./dto/create-vehicle.dto";
import type { AttachVehicleMediaDto } from "./dto/vehicle-media.dto";
import {
  VehicleBatchAction,
  type VehicleBatchActionDto,
} from "./dto/vehicle-actions.dto";
import type { VehicleQueryDto } from "./dto/vehicle-query.dto";
import { LegacyVehicleImporterService } from "./legacy-vehicle-importer.service";
import { VehicleCoverManager } from "./vehicle-cover-manager";
import { VehicleIdentityManager } from "./vehicle-identity.manager";
import { VehicleReferenceValidator } from "./vehicle-reference.validator";
import {
  createVehicleData,
  uniqueVehicleIds,
  updateVehicleData,
  vehicleBatchUpdateData,
  vehicleMediaRows,
} from "./vehicle-data.mapper";
import { buildAdminVehicleWhere } from "./vehicle-query";

const vehicleInclude = {
  brand: true,
  series: true,
  model: true,
  categoryRef: true,
  coverMedia: true,
  tags: { include: { tag: true } },
  media: {
    include: { media: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.VehicleInclude;

const IMAGE_COVER_REQUIRED_MESSAGE =
  "发布车辆至少需要一张图片，系统会将排序最靠前的图片作为封面。";
const vehicleTranslationFields = [
  {
    sourceField: "nameZh",
    translationKey: "name",
    englishField: "nameEn",
    russianField: "nameRu",
  },
  {
    sourceField: "shortDescriptionZh",
    translationKey: "shortDescription",
    englishField: "shortDescriptionEn",
    russianField: "shortDescriptionRu",
  },
  {
    sourceField: "descriptionZh",
    translationKey: "description",
    englishField: "descriptionEn",
    russianField: "descriptionRu",
  },
] as const;

@Injectable()
export class VehiclesService implements OnApplicationBootstrap {
  private readonly vehicleCover = new VehicleCoverManager();
  private readonly vehicleIdentity: VehicleIdentityManager;
  private readonly vehicleReferences: VehicleReferenceValidator;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly legacyVehicleImporter: LegacyVehicleImporterService,
    private readonly translation?: TranslationService,
  ) {
    this.vehicleIdentity = new VehicleIdentityManager(prisma);
    this.vehicleReferences = new VehicleReferenceValidator(prisma);
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.legacyVehicleImporter.ensure();
    await this.vehicleCover.normalizeOnce(this.prisma);
  }

  async list(query: VehicleQueryDto): Promise<unknown> {
    await this.legacyVehicleImporter.ensure();
    const where = buildAdminVehicleWhere(query);
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } as Prisma.VehicleOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        include: vehicleInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  async detail(id: bigint): Promise<unknown> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: vehicleInclude,
    });
    if (!vehicle) throw new NotFoundException("车辆不存在");
    return vehicle;
  }

  async exportCsv(
    query: VehicleQueryDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<string> {
    const rows = await this.prisma.vehicle.findMany({
      where: buildAdminVehicleWhere(query),
      include: { brand: true, series: true, model: true },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });
    const header = [
      "ID",
      "Stock No",
      "VIN",
      "Name",
      "English Name",
      "Brand",
      "Series",
      "Model",
      "Type",
      "Year",
      "Price",
      "Currency",
      "Status",
      "Sale Status",
      "Featured",
      "Created At",
      "Published At",
    ];
    const lines = rows.map((row) =>
      [
        row.id,
        row.stockNo,
        row.vin,
        row.nameZh,
        row.nameEn,
        row.brand.nameEn,
        row.series?.nameEn,
        row.model?.nameEn,
        row.type,
        row.year,
        row.price,
        row.currency,
        row.status,
        row.saleStatus,
        row.isFeatured,
        row.createdAt,
        row.publishedAt,
      ]
        .map(this.csvCell)
        .join(","),
    );
    await this.audit.record({
      actorId,
      action: "export",
      resourceType: "vehicle",
      summary: `Exported ${rows.length} vehicles`,
      meta,
    });
    return `\uFEFF${header.map(this.csvCell).join(",")}\r\n${lines.join("\r\n")}`;
  }

  async duplicate(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const source = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: { tags: true, media: true },
    });
    if (!source) throw new NotFoundException("车辆不存在");
    const suffix = Date.now().toString(36);
    const scalar = { ...source } as Record<string, unknown>;
    for (const key of [
      "id",
      "tags",
      "media",
      "createdAt",
      "updatedAt",
      "deletedAt",
      "publishedAt",
    ])
      delete scalar[key];
    Object.assign(scalar, {
      legacyId: null,
      vin: null,
      stockNo: `${source.stockNo.slice(0, 80)}-COPY-${suffix}`,
      slug: `${source.slug.slice(0, 170)}-copy-${suffix}`,
      nameZh: `${source.nameZh} 副本`,
      nameEn: `${source.nameEn} Copy`,
      status: ContentStatus.DRAFT,
      publishedAt: null,
      scheduledAt: null,
      createdById: actorId,
      updatedById: actorId,
    });
    const vehicle = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.vehicle.create({
        data: scalar as Prisma.VehicleUncheckedCreateInput,
      });
      if (source.tags.length)
        await transaction.vehicleTagRelation.createMany({
          data: source.tags.map(({ tagId }) => ({
            vehicleId: created.id,
            tagId,
          })),
        });
      if (source.media.length)
        await transaction.vehicleMedia.createMany({
          data: source.media.map(
            ({ mediaId, type, altZh, altEn, altRu, sortOrder, isCover }) => ({
              vehicleId: created.id,
              mediaId,
              type,
              altZh,
              altEn,
              altRu,
              sortOrder,
              isCover,
            }),
          ),
        });
      await this.vehicleCover.synchronize(transaction, created.id, actorId);
      return transaction.vehicle.findUniqueOrThrow({
        where: { id: created.id },
        include: vehicleInclude,
      });
    });
    await this.audit.record({
      actorId,
      action: "duplicate",
      resourceType: "vehicle",
      resourceId: vehicle.id,
      summary: `Duplicated vehicle ${id.toString()}`,
      afterData: vehicle,
      meta,
    });
    return vehicle;
  }

  async create(
    dto: CreateVehicleDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const publishNow = dto.publishNow === true;
    dto = await applyLocalizedFields(
      dto,
      this.translation,
      vehicleTranslationFields,
    );
    const references = await this.vehicleReferences.validateReferences(dto);
    const tagIds = uniqueVehicleIds(dto.tagIds);
    const media = dto.media ?? [];
    const baseSlug = this.vehicleIdentity.slugBase(dto);
    const manualStockNo = dto.stockNo?.trim();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const stockNo =
        manualStockNo || (await this.vehicleIdentity.nextGeneratedStockNo());
      const candidate = { ...dto, stockNo } as CreateVehicleDto;
      await this.vehicleReferences.assertIdentityAvailable(candidate);
      const slug = await this.vehicleIdentity.nextSlug(baseSlug);
      try {
        const vehicle = await this.prisma.$transaction(async (transaction) => {
          const created = await transaction.vehicle.create({
            data: {
              ...createVehicleData(candidate, actorId, slug),
              ...(references.categoryName !== undefined
                ? { category: references.categoryName }
                : {}),
            },
          });
          if (tagIds.length) {
            await transaction.vehicleTagRelation.createMany({
              data: tagIds.map((tagId) => ({ vehicleId: created.id, tagId })),
            });
          }
          if (media.length) {
            await transaction.vehicleMedia.createMany({
              data: vehicleMediaRows(created.id, media),
            });
          }
          const coverMediaId = await this.vehicleCover.synchronize(
            transaction,
            created.id,
            actorId,
          );
          if (publishNow) {
            if (!coverMediaId)
              throw new BadRequestException(IMAGE_COVER_REQUIRED_MESSAGE);
            await transaction.vehicle.update({
              where: { id: created.id },
              data: {
                status: ContentStatus.PUBLISHED,
                publishedAt: new Date(),
                scheduledAt: null,
                updatedById: actorId,
              },
            });
          }
          return transaction.vehicle.findUniqueOrThrow({
            where: { id: created.id },
            include: vehicleInclude,
          });
        });
        await this.audit.record({
          actorId,
          action: publishNow ? "create_publish" : "create",
          resourceType: "vehicle",
          resourceId: vehicle.id,
          afterData: vehicle,
          meta,
        });
        return vehicle;
      } catch (error) {
        if (
          !this.vehicleIdentity.isSlugConflict(error) &&
          (manualStockNo || !this.vehicleIdentity.isStockNoConflict(error))
        )
          throw error;
      }
    }

    throw new ConflictException("车辆链接标识生成冲突，请稍后重试");
  }

  async update(
    id: bigint,
    dto: UpdateVehicleDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const publishNow = dto.publishNow === true;
    dto = await applyLocalizedFields(
      dto,
      this.translation,
      vehicleTranslationFields,
    );
    const before = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: vehicleInclude,
    });
    if (!before) throw new NotFoundException("车辆不存在");
    await this.vehicleReferences.assertIdentityAvailable(dto, id);
    const references = await this.vehicleReferences.validateReferences(
      dto,
      before,
    );
    const vehicle = await this.prisma.$transaction(async (transaction) => {
      await transaction.vehicle.update({
        where: { id },
        data: {
          ...updateVehicleData(dto),
          ...(references.categoryName !== undefined
            ? { category: references.categoryName }
            : {}),
          updatedById: actorId,
        },
      });
      if (dto.tagIds) {
        const tagIds = uniqueVehicleIds(dto.tagIds);
        await transaction.vehicleTagRelation.deleteMany({
          where: { vehicleId: id },
        });
        if (tagIds.length) {
          await transaction.vehicleTagRelation.createMany({
            data: tagIds.map((tagId) => ({ vehicleId: id, tagId })),
          });
        }
      }
      if (dto.media) {
        await transaction.vehicleMedia.deleteMany({ where: { vehicleId: id } });
        if (dto.media.length)
          await transaction.vehicleMedia.createMany({
            data: vehicleMediaRows(id, dto.media),
          });
      }
      const coverMediaId = await this.vehicleCover.synchronize(
        transaction,
        id,
        actorId,
      );
      if (publishNow) {
        if (!coverMediaId)
          throw new BadRequestException(IMAGE_COVER_REQUIRED_MESSAGE);
        await transaction.vehicle.update({
          where: { id },
          data: {
            status: ContentStatus.PUBLISHED,
            publishedAt: before.publishedAt ?? new Date(),
            scheduledAt: null,
            updatedById: actorId,
          },
        });
      }
      return transaction.vehicle.findUniqueOrThrow({
        where: { id },
        include: vehicleInclude,
      });
    });
    await this.audit.record({
      actorId,
      action: publishNow ? "update_publish" : "update",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: before,
      afterData: vehicle,
      meta,
    });
    return vehicle;
  }

  async publish(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.activeVehicle(id);
    const coverMediaId = await this.prisma.$transaction((transaction) =>
      this.vehicleCover.synchronize(transaction, id, actorId),
    );
    if (!coverMediaId)
      throw new BadRequestException(IMAGE_COVER_REQUIRED_MESSAGE);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: before.publishedAt ?? new Date(),
        updatedById: actorId,
      },
      include: vehicleInclude,
    });
    await this.audit.record({
      actorId,
      action: "publish",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: before,
      afterData: vehicle,
      meta,
    });
    return vehicle;
  }

  async offline(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.activeVehicle(id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: { status: ContentStatus.OFFLINE, updatedById: actorId },
      include: vehicleInclude,
    });
    await this.audit.record({
      actorId,
      action: "offline",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: before,
      afterData: vehicle,
      meta,
    });
    return vehicle;
  }

  async setSaleStatus(
    id: bigint,
    saleStatus: VehicleSaleStatus,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.activeVehicle(id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: { saleStatus, updatedById: actorId },
      include: vehicleInclude,
    });
    await this.audit.record({
      actorId,
      action: "sale_status",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: before,
      afterData: vehicle,
      meta,
    });
    return vehicle;
  }

  async setFeatured(
    id: bigint,
    isFeatured: boolean,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.activeVehicle(id);
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: { isFeatured, updatedById: actorId },
      include: vehicleInclude,
    });
    await this.audit.record({
      actorId,
      action: isFeatured ? "feature" : "unfeature",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: before,
      afterData: vehicle,
      meta,
    });
    return vehicle;
  }

  async remove(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const before = await this.activeVehicle(id);
    await this.prisma.vehicle.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: ContentStatus.ARCHIVED,
        updatedById: actorId,
      },
    });
    await this.audit.record({
      actorId,
      action: "delete",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: before,
      meta,
    });
  }

  async restore(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    if (!before) throw new NotFoundException("已删除车辆不存在");
    const vehicle = await this.prisma.vehicle.update({
      where: { id },
      data: {
        deletedAt: null,
        status: ContentStatus.DRAFT,
        updatedById: actorId,
      },
      include: vehicleInclude,
    });
    await this.audit.record({
      actorId,
      action: "restore",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: before,
      afterData: vehicle,
      meta,
    });
    return vehicle;
  }

  async batch(
    dto: VehicleBatchActionDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<{ affected: number }> {
    const ids = uniqueVehicleIds(dto.ids);
    if (ids.length !== dto.ids.length)
      throw new BadRequestException("批量操作包含重复车辆 ID");
    const restore = dto.action === VehicleBatchAction.RESTORE;
    const existing = await this.prisma.vehicle.count({
      where: { id: { in: ids }, deletedAt: restore ? { not: null } : null },
    });
    if (existing !== ids.length)
      throw new NotFoundException("部分车辆不存在或状态不适用于当前操作");

    if (dto.action === VehicleBatchAction.PUBLISH) {
      let hasVehicleWithoutImageCover = false;
      await this.prisma.$transaction(async (transaction) => {
        for (const id of ids) {
          if (
            !(await this.vehicleCover.synchronize(transaction, id, actorId))
          ) {
            hasVehicleWithoutImageCover = true;
          }
        }
      });
      if (hasVehicleWithoutImageCover)
        throw new BadRequestException(IMAGE_COVER_REQUIRED_MESSAGE);
    }

    const data = vehicleBatchUpdateData(dto.action, actorId);
    const result = await this.prisma.vehicle.updateMany({
      where: { id: { in: ids } },
      data,
    });
    await this.audit.record({
      actorId,
      action: `batch_${dto.action.toLowerCase()}`,
      resourceType: "vehicle",
      summary: `Affected ${result.count} vehicles`,
      afterData: { ids: dto.ids, action: dto.action },
      meta,
    });
    return { affected: result.count };
  }

  async attachMedia(
    id: bigint,
    dto: AttachVehicleMediaDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.activeVehicle(id);
    await this.vehicleReferences.validateMedia(dto.items);
    await this.prisma.$transaction(async (transaction) => {
      for (const row of vehicleMediaRows(id, dto.items)) {
        const type = row.type ?? VehicleMediaType.GALLERY;
        await transaction.vehicleMedia.deleteMany({
          where: { vehicleId: id, mediaId: row.mediaId, type: { not: type } },
        });
        await transaction.vehicleMedia.upsert({
          where: {
            vehicleId_mediaId_type: {
              vehicleId: id,
              mediaId: row.mediaId,
              type,
            },
          },
          update: {
            altZh: row.altZh,
            altEn: row.altEn,
            altRu: row.altRu,
            sortOrder: row.sortOrder,
            isCover: false,
          },
          create: { ...row, type },
        });
      }
      await this.vehicleCover.synchronize(transaction, id, actorId);
    });
    const vehicle = await this.detail(id);
    await this.audit.record({
      actorId,
      action: "attach_media",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: before,
      afterData: vehicle,
      meta,
    });
    return vehicle;
  }

  async detachMedia(
    id: bigint,
    mediaId: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    await this.activeVehicle(id);
    const relation = await this.prisma.vehicleMedia.findFirst({
      where: { vehicleId: id, mediaId },
    });
    if (!relation) throw new NotFoundException("车辆素材关联不存在");
    await this.prisma.$transaction(async (transaction) => {
      await transaction.vehicleMedia.deleteMany({
        where: { vehicleId: id, mediaId },
      });
      await this.vehicleCover.synchronize(transaction, id, actorId);
    });
    await this.audit.record({
      actorId,
      action: "detach_media",
      resourceType: "vehicle",
      resourceId: id,
      beforeData: relation,
      meta,
    });
  }

  private async activeVehicle(
    id: bigint,
  ): Promise<Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
      include: vehicleInclude,
    });
    if (!vehicle) throw new NotFoundException("车辆不存在");
    return vehicle;
  }

  private readonly csvCell = (value: unknown): string => {
    let text: string;
    if (value == null) text = "";
    else if (typeof value === "string") text = value;
    else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    )
      text = value.toString();
    else if (value instanceof Date) text = value.toISOString();
    else if (value instanceof Prisma.Decimal) text = value.toString();
    else text = JSON.stringify(value);
    if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
}
