import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MediaAssetStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { TranslationService } from "../translation/translation.service";
import { applyLocalizedFields } from "../translation/localized-fields";
import {
  brandUpdateData,
  categoryCreateData,
  categoryUpdateData,
  modelUpdateData,
  seriesUpdateData,
  tagCreateData,
  tagUpdateData,
} from "./catalog-data.mapper";
import type {
  CreateBrandDto,
  CreateCategoryDto,
  CreateModelDto,
  QuickCreateBrandDto,
  CreateSeriesDto,
  CreateTagDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateModelDto,
  UpdateSeriesDto,
  UpdateTagDto,
} from "./dto/catalog.dto";

const catalogTranslationFields = [
  {
    sourceField: "nameZh",
    translationKey: "name",
    englishField: "nameEn",
    russianField: "nameRu",
  },
  {
    sourceField: "descriptionZh",
    translationKey: "description",
    englishField: "descriptionEn",
    russianField: "descriptionRu",
  },
] as const;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly translation?: TranslationService,
  ) {}

  async createBrand(
    dto: CreateBrandDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    if (dto.logoMediaId) await this.assertMedia(BigInt(dto.logoMediaId));
    const slug = await this.nextBrandSlug(this.slugFor(dto, "brand"));
    const data = {
      ...brandUpdateData(dto),
      nameZh: dto.nameZh,
      nameEn: dto.nameEn ?? dto.nameZh,
      slug,
      createdById: actorId,
      updatedById: actorId,
    } as Prisma.BrandUncheckedCreateInput;
    const brand = await this.prisma.brand.create({ data });
    await this.record(
      "create",
      "brand",
      brand.id,
      actorId,
      meta,
      undefined,
      brand,
    );
    return brand;
  }

  async quickCreateBrand(
    dto: QuickCreateBrandDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const name = this.normalizeBrandName(dto.name);
    if (!name) throw new BadRequestException("品牌名称不能为空");

    const existing = await this.findBrandByName(name);
    if (existing) {
      if (!existing.isEnabled)
        throw new ConflictException("该品牌已停用，请在品牌管理中启用后再使用");
      return existing;
    }

    const localized = await this.localizedName<{
      nameZh: string;
      nameEn?: string;
      nameRu?: string;
    }>({ nameZh: name });
    const baseSlug = this.slugBase(localized.nameEn ?? name, "brand");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const slug = await this.nextBrandSlug(baseSlug);
      try {
        const brand = await this.prisma.brand.create({
          data: {
            nameZh: name,
            nameEn: localized.nameEn ?? name,
            nameRu: localized.nameRu,
            slug,
            isEnabled: true,
            createdById: actorId,
            updatedById: actorId,
          },
        });
        await this.record(
          "create",
          "brand",
          brand.id,
          actorId,
          meta,
          undefined,
          brand,
        );
        return brand;
      } catch (error) {
        if (!this.isUniqueSlugConflict(error)) throw error;
        const concurrentBrand = await this.findBrandByName(name);
        if (concurrentBrand) {
          if (!concurrentBrand.isEnabled)
            throw new ConflictException(
              "该品牌已停用，请在品牌管理中启用后再使用",
            );
          return concurrentBrand;
        }
      }
    }

    throw new ConflictException("品牌创建冲突，请稍后重试");
  }

  async updateBrand(
    id: bigint,
    dto: UpdateBrandDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const before = await this.brand(id);
    if (dto.logoMediaId) await this.assertMedia(BigInt(dto.logoMediaId));
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { ...brandUpdateData(dto), updatedById: actorId },
    });
    await this.record("update", "brand", id, actorId, meta, before, brand);
    return brand;
  }

  async removeBrand(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    const before = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { series: true, vehicleModels: true, vehicles: true },
        },
      },
    });
    if (!before) throw new NotFoundException("品牌不存在");
    if (
      before._count.series ||
      before._count.vehicleModels ||
      before._count.vehicles
    ) {
      throw new ConflictException(
        "品牌存在关联车系、车型或车辆，请先停用而不是删除",
      );
    }
    await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date(), isEnabled: false, updatedById: actorId },
    });
    await this.record("delete", "brand", id, actorId, meta, before);
  }

  async createSeries(
    dto: CreateSeriesDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const brandId = BigInt(dto.brandId);
    await this.brand(brandId);
    const slug = await this.nextSeriesSlug(
      brandId,
      this.slugFor(dto, "series"),
    );
    const data = {
      ...seriesUpdateData(dto),
      brandId,
      nameZh: dto.nameZh,
      nameEn: dto.nameEn ?? dto.nameZh,
      slug,
      createdById: actorId,
      updatedById: actorId,
    } as Prisma.VehicleSeriesUncheckedCreateInput;
    const series = await this.prisma.vehicleSeries.create({ data });
    await this.record(
      "create",
      "vehicle_series",
      series.id,
      actorId,
      meta,
      undefined,
      series,
    );
    return series;
  }

  async updateSeries(
    id: bigint,
    dto: UpdateSeriesDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const before = await this.vehicleSeries(id);
    if (dto.brandId) await this.brand(BigInt(dto.brandId));
    const series = await this.prisma.vehicleSeries.update({
      where: { id },
      data: { ...seriesUpdateData(dto), updatedById: actorId },
    });
    await this.record(
      "update",
      "vehicle_series",
      id,
      actorId,
      meta,
      before,
      series,
    );
    return series;
  }

  async removeSeries(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    const before = await this.prisma.vehicleSeries.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { models: true, vehicles: true } } },
    });
    if (!before) throw new NotFoundException("车系不存在");
    if (before._count.models || before._count.vehicles)
      throw new ConflictException("车系存在关联车型或车辆，不能删除");
    await this.prisma.vehicleSeries.update({
      where: { id },
      data: { deletedAt: new Date(), isEnabled: false, updatedById: actorId },
    });
    await this.record("delete", "vehicle_series", id, actorId, meta, before);
  }

  async createModel(
    dto: CreateModelDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const brandId = BigInt(dto.brandId);
    const seriesId = BigInt(dto.seriesId);
    await this.assertSeriesBrand(seriesId, brandId);
    const slug = await this.nextModelSlug(
      brandId,
      seriesId,
      this.slugFor(dto, "model"),
    );
    const data = {
      ...modelUpdateData(dto),
      brandId,
      seriesId,
      nameZh: dto.nameZh,
      nameEn: dto.nameEn ?? dto.nameZh,
      slug,
      createdById: actorId,
      updatedById: actorId,
    } as Prisma.VehicleModelUncheckedCreateInput;
    const model = await this.prisma.vehicleModel.create({ data });
    await this.record(
      "create",
      "vehicle_model",
      model.id,
      actorId,
      meta,
      undefined,
      model,
    );
    return model;
  }

  async updateModel(
    id: bigint,
    dto: UpdateModelDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const before = await this.vehicleModel(id);
    const brandId = dto.brandId ? BigInt(dto.brandId) : before.brandId;
    const seriesId = dto.seriesId ? BigInt(dto.seriesId) : before.seriesId;
    await this.assertSeriesBrand(seriesId, brandId);
    const model = await this.prisma.vehicleModel.update({
      where: { id },
      data: { ...modelUpdateData(dto), updatedById: actorId },
    });
    await this.record(
      "update",
      "vehicle_model",
      id,
      actorId,
      meta,
      before,
      model,
    );
    return model;
  }

  async removeModel(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    const before = await this.prisma.vehicleModel.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { vehicles: true } } },
    });
    if (!before) throw new NotFoundException("车型不存在");
    if (before._count.vehicles)
      throw new ConflictException("车型存在关联车辆，不能删除");
    await this.prisma.vehicleModel.update({
      where: { id },
      data: { deletedAt: new Date(), isEnabled: false, updatedById: actorId },
    });
    await this.record("delete", "vehicle_model", id, actorId, meta, before);
  }

  async createCategory(
    dto: CreateCategoryDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const slug = await this.nextCategorySlug(
      this.slugFor(dto, "category", 100),
    );
    const category = await this.prisma.vehicleCategory.create({
      data: {
        ...categoryCreateData(dto),
        nameZh: dto.nameZh,
        nameEn: dto.nameEn ?? dto.nameZh,
        slug,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    await this.record(
      "create",
      "vehicle_category",
      category.id,
      actorId,
      meta,
      undefined,
      category,
    );
    return category;
  }

  async updateCategory(
    id: bigint,
    dto: UpdateCategoryDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const before = await this.prisma.vehicleCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) throw new NotFoundException("车辆分类不存在");
    const category = await this.prisma.vehicleCategory.update({
      where: { id },
      data: { ...categoryUpdateData(dto), updatedById: actorId },
    });
    await this.record(
      "update",
      "vehicle_category",
      id,
      actorId,
      meta,
      before,
      category,
    );
    return category;
  }

  async removeCategory(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    const before = await this.prisma.vehicleCategory.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { vehicles: true } } },
    });
    if (!before) throw new NotFoundException("车辆分类不存在");
    if (before._count.vehicles)
      throw new ConflictException("分类仍被车辆使用，请先停用而不是删除");
    await this.prisma.vehicleCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isEnabled: false, updatedById: actorId },
    });
    await this.record("delete", "vehicle_category", id, actorId, meta, before);
  }

  async createTag(
    dto: CreateTagDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const slug = await this.nextTagSlug(this.slugFor(dto, "tag", 100));
    const tag = await this.prisma.vehicleTag.create({
      data: {
        ...tagCreateData(dto),
        nameZh: dto.nameZh,
        nameEn: dto.nameEn ?? dto.nameZh,
        slug,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    await this.record(
      "create",
      "vehicle_tag",
      tag.id,
      actorId,
      meta,
      undefined,
      tag,
    );
    return tag;
  }

  async updateTag(
    id: bigint,
    dto: UpdateTagDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedName(dto);
    const before = await this.prisma.vehicleTag.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("标签不存在");
    const tag = await this.prisma.vehicleTag.update({
      where: { id },
      data: { ...tagUpdateData(dto), updatedById: actorId },
    });
    await this.record("update", "vehicle_tag", id, actorId, meta, before, tag);
    return tag;
  }

  async removeTag(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    const before = await this.prisma.vehicleTag.findUnique({
      where: { id },
      include: { _count: { select: { vehicles: true } } },
    });
    if (!before) throw new NotFoundException("标签不存在");
    if (before._count.vehicles)
      throw new ConflictException("标签仍被车辆使用，不能删除");
    await this.prisma.vehicleTag.delete({ where: { id } });
    await this.record("delete", "vehicle_tag", id, actorId, meta, before);
  }

  private normalizeBrandName(value: string): string {
    return value.trim().replace(/\s+/g, " ");
  }

  private findBrandByName(name: string) {
    return this.prisma.brand.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { nameZh: { equals: name } },
          { nameEn: { equals: name } },
          { nameRu: { equals: name } },
        ],
      },
    });
  }

  private async localizedName<
    T extends {
      nameZh?: string;
      nameEn?: string;
      nameRu?: string;
      descriptionZh?: string;
      descriptionEn?: string;
      descriptionRu?: string;
    },
  >(dto: T): Promise<T> {
    return applyLocalizedFields(
      dto,
      this.translation,
      catalogTranslationFields,
    );
  }

  private slugFor(
    dto: { slug?: string; nameZh: string; nameEn?: string },
    prefix: string,
    maxLength = 191,
  ): string {
    return this.slugBase(
      dto.slug?.trim() || dto.nameEn || dto.nameZh,
      prefix,
      maxLength,
    );
  }

  private slugBase(value: string, prefix: string, maxLength = 191): string {
    const slug = value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength);
    if (slug) return slug;
    return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
  }

  private async nextBrandSlug(base: string): Promise<string> {
    return this.nextAvailableSlug(base, async (slug) =>
      Boolean(
        await this.prisma.brand.findUnique({
          where: { slug },
          select: { id: true },
        }),
      ),
    );
  }

  private async nextSeriesSlug(brandId: bigint, base: string): Promise<string> {
    return this.nextAvailableSlug(base, async (slug) =>
      Boolean(
        await this.prisma.vehicleSeries.findFirst({
          where: { brandId, slug, deletedAt: null },
          select: { id: true },
        }),
      ),
    );
  }

  private async nextModelSlug(
    brandId: bigint,
    seriesId: bigint,
    base: string,
  ): Promise<string> {
    return this.nextAvailableSlug(base, async (slug) =>
      Boolean(
        await this.prisma.vehicleModel.findFirst({
          where: { brandId, seriesId, slug, deletedAt: null },
          select: { id: true },
        }),
      ),
    );
  }

  private async nextCategorySlug(base: string): Promise<string> {
    return this.nextAvailableSlug(
      base,
      async (slug) =>
        Boolean(
          await this.prisma.vehicleCategory.findFirst({
            where: { slug },
            select: { id: true },
          }),
        ),
      100,
    );
  }

  private async nextTagSlug(base: string): Promise<string> {
    return this.nextAvailableSlug(
      base,
      async (slug) =>
        Boolean(
          await this.prisma.vehicleTag.findFirst({
            where: { slug },
            select: { id: true },
          }),
        ),
      100,
    );
  }

  private async nextAvailableSlug(
    base: string,
    exists: (slug: string) => Promise<boolean>,
    maxLength = 191,
  ): Promise<string> {
    for (let index = 1; index <= 10_000; index += 1) {
      const suffix = index === 1 ? "" : `-${index}`;
      const slug = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
      if (!(await exists(slug))) return slug;
    }
    throw new ConflictException("链接标识已达到可用上限");
  }

  private isUniqueSlugConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private async brand(id: bigint): Promise<{ id: bigint }> {
    const brand = await this.prisma.brand.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!brand) throw new NotFoundException("品牌不存在");
    return brand;
  }

  private async vehicleSeries(
    id: bigint,
  ): Promise<{ id: bigint; brandId: bigint }> {
    const series = await this.prisma.vehicleSeries.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, brandId: true },
    });
    if (!series) throw new NotFoundException("车系不存在");
    return series;
  }

  private async vehicleModel(
    id: bigint,
  ): Promise<{ id: bigint; brandId: bigint; seriesId: bigint }> {
    const model = await this.prisma.vehicleModel.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, brandId: true, seriesId: true },
    });
    if (!model) throw new NotFoundException("车型不存在");
    return model;
  }

  private async assertSeriesBrand(
    seriesId: bigint,
    brandId: bigint,
  ): Promise<void> {
    const series = await this.vehicleSeries(seriesId);
    if (series.brandId !== brandId)
      throw new ConflictException("车系不属于所选品牌");
  }

  private async assertMedia(id: bigint): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id, status: MediaAssetStatus.ACTIVE, deletedAt: null },
    });
    if (!media) throw new NotFoundException("品牌 Logo 素材不存在");
  }

  private record(
    action: string,
    resourceType: string,
    resourceId: bigint,
    actorId: bigint,
    meta: RequestMeta,
    beforeData?: unknown,
    afterData?: unknown,
  ): Promise<void> {
    return this.audit.record({
      actorId,
      action,
      resourceType,
      resourceId,
      beforeData,
      afterData,
      meta,
    });
  }
}
