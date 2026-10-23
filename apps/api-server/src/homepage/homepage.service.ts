import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BannerStatus, FeatureIconType, MediaAssetStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { sanitizeSvg } from '../common/security/sanitize-svg';
import type { RequestMeta } from '../common/utils/request-meta';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { CreateBannerDto } from './dto/create-banner.dto';
import type { CreateFeatureDto } from './dto/create-feature.dto';
import type { SortItemsDto } from './dto/sort-items.dto';
import type { UpdateBannerDto } from './dto/update-banner.dto';
import type { UpdateFeatureDto } from './dto/update-feature.dto';
import type { UpdateSectionDto } from './dto/update-section.dto';
import type { CreateRecommendationDto, RecommendationQueryDto, UpdateRecommendationDto } from './dto/recommendation.dto';
import { buildPublicVehicleAvailability } from '../vehicles/vehicle-query';

const bannerInclude = { desktopMedia: true, mobileMedia: true } satisfies Prisma.BannerInclude;
const featureInclude = { imageMedia: true } satisfies Prisma.FeatureItemInclude;

@Injectable()
export class HomepageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  adminBanners(): Promise<unknown> {
    return this.prisma.banner.findMany({
      where: { deletedAt: null },
      include: bannerInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  publicBanners(): Promise<unknown> {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        deletedAt: null,
        status: BannerStatus.ACTIVE,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      include: bannerInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createBanner(dto: CreateBannerDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    await this.validateBanner(dto);
    const banner = await this.prisma.banner.create({
      data: { ...this.bannerCreateData(dto), createdById: actorId, updatedById: actorId },
      include: bannerInclude,
    });
    await this.audit.record({ actorId, action: 'create', resourceType: 'banner', resourceId: banner.id, afterData: banner, meta });
    return banner;
  }

  async updateBanner(id: bigint, dto: UpdateBannerDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.banner.findFirst({ where: { id, deletedAt: null }, include: bannerInclude });
    if (!before) throw new NotFoundException('轮播图不存在');
    await this.validateBanner(dto, before);
    const banner = await this.prisma.banner.update({
      where: { id },
      data: { ...this.bannerData(dto), updatedById: actorId },
      include: bannerInclude,
    });
    await this.audit.record({ actorId, action: 'update', resourceType: 'banner', resourceId: id, beforeData: before, afterData: banner, meta });
    return banner;
  }

  async removeBanner(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const before = await this.prisma.banner.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('轮播图不存在');
    await this.prisma.banner.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId } });
    await this.audit.record({ actorId, action: 'delete', resourceType: 'banner', resourceId: id, beforeData: before, meta });
  }

  async sortBanners(dto: SortItemsDto, actorId: bigint, meta: RequestMeta): Promise<void> {
    await this.sortEntities('banner', dto, actorId);
    await this.audit.record({ actorId, action: 'sort', resourceType: 'banner', afterData: dto.items, meta });
  }

  adminFeatures(): Promise<unknown> {
    return this.prisma.featureItem.findMany({
      where: { deletedAt: null },
      include: featureInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  publicFeatures(): Promise<unknown> {
    return this.prisma.featureItem.findMany({
      where: { deletedAt: null, isEnabled: true },
      include: featureInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createFeature(dto: CreateFeatureDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    await this.validateFeature(dto);
    const feature = await this.prisma.featureItem.create({
      data: { ...this.featureCreateData(dto), createdById: actorId, updatedById: actorId },
      include: featureInclude,
    });
    await this.audit.record({ actorId, action: 'create', resourceType: 'feature_item', resourceId: feature.id, afterData: feature, meta });
    return feature;
  }

  async updateFeature(id: bigint, dto: UpdateFeatureDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.featureItem.findFirst({ where: { id, deletedAt: null }, include: featureInclude });
    if (!before) throw new NotFoundException('优势图标不存在');
    await this.validateFeature(dto, before.iconType);
    const feature = await this.prisma.featureItem.update({
      where: { id },
      data: { ...this.featureData(dto), updatedById: actorId },
      include: featureInclude,
    });
    await this.audit.record({ actorId, action: 'update', resourceType: 'feature_item', resourceId: id, beforeData: before, afterData: feature, meta });
    return feature;
  }

  async removeFeature(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const before = await this.prisma.featureItem.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('优势图标不存在');
    await this.prisma.featureItem.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId } });
    await this.audit.record({ actorId, action: 'delete', resourceType: 'feature_item', resourceId: id, beforeData: before, meta });
  }

  async sortFeatures(dto: SortItemsDto, actorId: bigint, meta: RequestMeta): Promise<void> {
    await this.sortEntities('feature', dto, actorId);
    await this.audit.record({ actorId, action: 'sort', resourceType: 'feature_item', afterData: dto.items, meta });
  }

  adminSections(): Promise<unknown> {
    return this.prisma.homepageSection.findMany({
      include: { backgroundMedia: true, _count: { select: { recommendations: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateSection(id: bigint, dto: UpdateSectionDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.homepageSection.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('首页模块不存在');
    const backgroundMediaId = dto.backgroundMediaId ? BigInt(dto.backgroundMediaId) : undefined;
    if (backgroundMediaId) await this.assertMedia(backgroundMediaId);
    const section = await this.prisma.homepageSection.update({
      where: { id },
      data: {
        titleZh: dto.titleZh,
        titleEn: dto.titleEn,
        titleRu: dto.titleRu,
        subtitleZh: dto.subtitleZh,
        subtitleEn: dto.subtitleEn,
        subtitleRu: dto.subtitleRu,
        descriptionZh: dto.descriptionZh,
        descriptionEn: dto.descriptionEn,
        descriptionRu: dto.descriptionRu,
        backgroundMediaId,
        displayCount: dto.displayCount,
        sortOrder: dto.sortOrder,
        isEnabled: dto.isEnabled,
        styleKey: dto.styleKey,
        config: dto.config as Prisma.InputJsonValue | undefined,
        updatedById: actorId,
      },
      include: { backgroundMedia: true },
    });
    await this.audit.record({ actorId, action: 'update', resourceType: 'homepage_section', resourceId: id, beforeData: before, afterData: section, meta });
    return section;
  }

  async sortSections(dto: SortItemsDto, actorId: bigint, meta: RequestMeta): Promise<void> {
    await this.sortEntities('section', dto, actorId);
    await this.audit.record({ actorId, action: 'sort', resourceType: 'homepage_section', afterData: dto.items, meta });
  }

  adminRecommendations(query: RecommendationQueryDto): Promise<unknown> {
    return this.prisma.homepageRecommendation.findMany({
      where: { homepageSectionId: query.sectionId ? BigInt(query.sectionId) : undefined },
      include: {
        homepageSection: { select: { id: true, key: true, titleZh: true, titleEn: true } },
        vehicle: { include: { brand: true, coverMedia: true } },
      },
      orderBy: [{ homepageSectionId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createRecommendation(dto: CreateRecommendationDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    await this.validateRecommendation(dto);
    const recommendation = await this.prisma.homepageRecommendation.create({
      data: {
        homepageSectionId: BigInt(dto.homepageSectionId),
        vehicleId: BigInt(dto.vehicleId),
        label: dto.label,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        sortOrder: dto.sortOrder,
        isEnabled: dto.isEnabled,
        createdById: actorId,
      },
      include: { homepageSection: true, vehicle: { include: { brand: true, coverMedia: true } } },
    });
    await this.audit.record({ actorId, action: 'create', resourceType: 'homepage_recommendation', resourceId: recommendation.id, afterData: recommendation, meta });
    return recommendation;
  }

  async updateRecommendation(id: bigint, dto: UpdateRecommendationDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.homepageRecommendation.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('推荐车辆不存在');
    await this.validateRecommendation(dto, before);
    const recommendation = await this.prisma.homepageRecommendation.update({
      where: { id },
      data: {
        homepageSectionId: dto.homepageSectionId ? BigInt(dto.homepageSectionId) : undefined,
        vehicleId: dto.vehicleId ? BigInt(dto.vehicleId) : undefined,
        label: dto.label,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : dto.startsAt === null ? null : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : dto.endsAt === null ? null : undefined,
        sortOrder: dto.sortOrder,
        isEnabled: dto.isEnabled,
      },
      include: { homepageSection: true, vehicle: { include: { brand: true, coverMedia: true } } },
    });
    await this.audit.record({ actorId, action: 'update', resourceType: 'homepage_recommendation', resourceId: id, beforeData: before, afterData: recommendation, meta });
    return recommendation;
  }

  async removeRecommendation(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const before = await this.prisma.homepageRecommendation.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('推荐车辆不存在');
    await this.prisma.homepageRecommendation.delete({ where: { id } });
    await this.audit.record({ actorId, action: 'delete', resourceType: 'homepage_recommendation', resourceId: id, beforeData: before, meta });
  }

  async sortRecommendations(dto: SortItemsDto, actorId: bigint, meta: RequestMeta): Promise<void> {
    const ids = dto.items.map(({ id }) => BigInt(id));
    const count = await this.prisma.homepageRecommendation.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException('排序列表包含不存在的推荐车辆');
    await this.prisma.$transaction(dto.items.map(({ id, sortOrder }) => this.prisma.homepageRecommendation.update({
      where: { id: BigInt(id) }, data: { sortOrder },
    })));
    await this.audit.record({ actorId, action: 'sort', resourceType: 'homepage_recommendation', afterData: dto.items, meta });
  }

  async publicHome(): Promise<Record<string, unknown>> {
    const now = new Date();
    const [sections, banners, features] = await Promise.all([
      this.prisma.homepageSection.findMany({
        where: { OR: [{ isEnabled: true }, { type: 'FEATURED_VEHICLES' }] },
        include: {
          backgroundMedia: true,
          _count: { select: { recommendations: true } },
          recommendations: {
            where: {
              isEnabled: true,
              vehicle: buildPublicVehicleAvailability(),
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
              ],
            },
            include: { vehicle: { include: { brand: true, coverMedia: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.publicBanners(),
      this.publicFeatures(),
    ]);
    return { sections, banners, features };
  }

  private bannerData(dto: UpdateBannerDto): Prisma.BannerUncheckedUpdateInput {
    return {
      key: dto.key,
      titleZh: dto.titleZh,
      titleEn: dto.titleEn,
      titleRu: dto.titleRu,
      subtitleZh: dto.subtitleZh,
      subtitleEn: dto.subtitleEn,
      subtitleRu: dto.subtitleRu,
      descriptionZh: dto.descriptionZh,
      descriptionEn: dto.descriptionEn,
      descriptionRu: dto.descriptionRu,
      desktopMediaId: dto.desktopMediaId ? BigInt(dto.desktopMediaId) : undefined,
      mobileMediaId: dto.mobileMediaId ? BigInt(dto.mobileMediaId) : undefined,
      buttonTextZh: dto.buttonTextZh,
      buttonTextEn: dto.buttonTextEn,
      buttonTextRu: dto.buttonTextRu,
      linkUrl: dto.linkUrl,
      linkTarget: dto.linkTarget,
      status: dto.status,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      sortOrder: dto.sortOrder,
    };
  }

  private bannerCreateData(dto: CreateBannerDto): Prisma.BannerUncheckedCreateInput {
    return { ...this.bannerData(dto), key: dto.key } as Prisma.BannerUncheckedCreateInput;
  }

  private featureData(dto: UpdateFeatureDto): Prisma.FeatureItemUncheckedUpdateInput {
    const svgContent = dto.svgContent ? sanitizeSvg(dto.svgContent) : undefined;
    return {
      key: dto.key,
      iconType: dto.iconType,
      iconName: dto.iconName,
      svgContent,
      imageMediaId: dto.imageMediaId ? BigInt(dto.imageMediaId) : undefined,
      titleZh: dto.titleZh,
      titleEn: dto.titleEn,
      titleRu: dto.titleRu,
      descriptionZh: dto.descriptionZh,
      descriptionEn: dto.descriptionEn,
      descriptionRu: dto.descriptionRu,
      linkUrl: dto.linkUrl,
      sortOrder: dto.sortOrder,
      isEnabled: dto.isEnabled,
    };
  }

  private featureCreateData(dto: CreateFeatureDto): Prisma.FeatureItemUncheckedCreateInput {
    return {
      ...this.featureData(dto),
      key: dto.key,
      iconType: dto.iconType,
      titleZh: dto.titleZh,
      titleEn: dto.titleEn,
    } as Prisma.FeatureItemUncheckedCreateInput;
  }

  private async validateBanner(dto: UpdateBannerDto, current?: { startsAt: Date | null; endsAt: Date | null }): Promise<void> {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : dto.startsAt === null ? null : current?.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : dto.endsAt === null ? null : current?.endsAt;
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException('轮播图结束时间必须晚于开始时间');
    const ids = [dto.desktopMediaId, dto.mobileMediaId].filter((id): id is string => Boolean(id)).map(BigInt);
    for (const id of ids) await this.assertMedia(id);
  }

  private async validateFeature(dto: UpdateFeatureDto, currentType?: FeatureIconType): Promise<void> {
    const type = dto.iconType ?? currentType;
    if (type === FeatureIconType.SVG && dto.svgContent) sanitizeSvg(dto.svgContent);
    if (type === FeatureIconType.IMAGE && dto.imageMediaId) await this.assertMedia(BigInt(dto.imageMediaId));
    if (dto.iconType === FeatureIconType.BUILTIN && !dto.iconName) throw new BadRequestException('内置图标必须填写图标名称');
  }

  private async validateRecommendation(
    dto: UpdateRecommendationDto,
    current?: { homepageSectionId: bigint; vehicleId: bigint; startsAt: Date | null; endsAt: Date | null },
  ): Promise<void> {
    const sectionId = dto.homepageSectionId ? BigInt(dto.homepageSectionId) : current?.homepageSectionId;
    const vehicleId = dto.vehicleId ? BigInt(dto.vehicleId) : current?.vehicleId;
    if (!sectionId || !vehicleId) throw new BadRequestException('推荐车辆必须关联首页模块和车辆');
    const [section, vehicle] = await Promise.all([
      this.prisma.homepageSection.findUnique({ where: { id: sectionId }, select: { id: true } }),
      this.prisma.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!section) throw new NotFoundException('首页模块不存在');
    if (!vehicle) throw new NotFoundException('推荐车辆不存在');
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current?.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current?.endsAt;
    if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException('推荐结束时间必须晚于开始时间');
  }

  private async assertMedia(id: bigint): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id, status: MediaAssetStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });
    if (!media) throw new NotFoundException('引用的素材不存在');
  }

  private async sortEntities(kind: 'banner' | 'feature' | 'section', dto: SortItemsDto, actorId: bigint): Promise<void> {
    const ids = dto.items.map(({ id }) => BigInt(id));
    if (new Set(ids.map(String)).size !== ids.length) throw new BadRequestException('排序列表包含重复 ID');
    const count =
      kind === 'banner'
        ? await this.prisma.banner.count({ where: { id: { in: ids }, deletedAt: null } })
        : kind === 'feature'
          ? await this.prisma.featureItem.count({ where: { id: { in: ids }, deletedAt: null } })
          : await this.prisma.homepageSection.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException('排序列表包含不存在的项目');
    await this.prisma.$transaction(
      dto.items.map((item) => {
        const id = BigInt(item.id);
        if (kind === 'banner') return this.prisma.banner.update({ where: { id }, data: { sortOrder: item.sortOrder, updatedById: actorId } });
        if (kind === 'feature') return this.prisma.featureItem.update({ where: { id }, data: { sortOrder: item.sortOrder, updatedById: actorId } });
        return this.prisma.homepageSection.update({ where: { id }, data: { sortOrder: item.sortOrder, updatedById: actorId } });
      }),
    );
  }
}
