import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ContentStatus, MediaAssetStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { paginated } from "../common/interfaces/api-response";
import { sanitizePlainText } from "../common/security/sanitize-plain-text";
import { sanitizeRichText } from "../common/security/sanitize-rich-text";
import type { RequestMeta } from "../common/utils/request-meta";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { TranslationService } from "../translation/translation.service";
import { applyLocalizedFields } from "../translation/localized-fields";
import type {
  CreateNavigationDto,
  CreatePageDto,
  NavigationQueryDto,
  PageQueryDto,
  SortContentItemsDto,
  UpdateNavigationDto,
  UpdatePageDto,
} from "./dto/content.dto";

const pageInclude = { ogMedia: true } satisfies Prisma.PageInclude;
const pageTranslationFields = [
  {
    sourceField: "titleZh",
    translationKey: "title",
    englishField: "titleEn",
    russianField: "titleRu",
    fallback: "source",
  },
  {
    sourceField: "summaryZh",
    translationKey: "summary",
    englishField: "summaryEn",
    russianField: "summaryRu",
    fallback: "source",
  },
  {
    sourceField: "contentZh",
    translationKey: "content",
    englishField: "contentEn",
    russianField: "contentRu",
    fallback: "source",
  },
] as const;

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly translation?: TranslationService,
  ) {}

  navigation(query: NavigationQueryDto): Promise<unknown> {
    return this.prisma.navigationItem.findMany({
      where: {
        deletedAt: null,
        isEnabled: query.enabled,
        ...(query.keyword
          ? {
              OR: [
                { labelZh: { contains: query.keyword } },
                { labelEn: { contains: query.keyword } },
                { key: { contains: query.keyword } },
              ],
            }
          : {}),
      },
      include: {
        parent: { select: { id: true, labelZh: true, labelEn: true } },
        _count: { select: { children: true } },
      },
      orderBy: [
        { parentId: "asc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });
  }

  async createNavigation(
    dto: CreateNavigationDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    this.assertHref(dto.href);
    const parentId = dto.parentId ? BigInt(dto.parentId) : null;
    if (parentId) await this.assertTopLevelParent(parentId);
    const item = await this.prisma.navigationItem.create({
      data: {
        ...dto,
        parentId,
        labelZh: sanitizePlainText(dto.labelZh)!,
        labelEn: sanitizePlainText(dto.labelEn)!,
        labelRu: sanitizePlainText(dto.labelRu),
        createdById: actorId,
        updatedById: actorId,
      },
    });
    await this.audit.record({
      actorId,
      action: "create",
      resourceType: "navigation",
      resourceId: item.id,
      afterData: item,
      meta,
    });
    return item;
  }

  async updateNavigation(
    id: bigint,
    dto: UpdateNavigationDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.navigationItem(id);
    if (dto.href) this.assertHref(dto.href);
    const parentId = dto.parentId
      ? BigInt(dto.parentId)
      : dto.parentId === null
        ? null
        : undefined;
    if (parentId) {
      if (parentId === id)
        throw new BadRequestException("导航菜单不能选择自己作为父级");
      await this.assertTopLevelParent(parentId);
      const children = await this.prisma.navigationItem.count({
        where: { parentId: id, deletedAt: null },
      });
      if (children)
        throw new ConflictException("包含子菜单的导航不能移动到其他菜单下");
    }
    const item = await this.prisma.navigationItem.update({
      where: { id },
      data: {
        key: dto.key,
        parentId,
        labelZh: sanitizePlainText(dto.labelZh),
        labelEn: sanitizePlainText(dto.labelEn),
        labelRu: sanitizePlainText(dto.labelRu),
        href: dto.href,
        target: dto.target,
        icon: sanitizePlainText(dto.icon),
        sortOrder: dto.sortOrder,
        isEnabled: dto.isEnabled,
        updatedById: actorId,
      },
    });
    await this.audit.record({
      actorId,
      action: "update",
      resourceType: "navigation",
      resourceId: id,
      beforeData: before,
      afterData: item,
      meta,
    });
    return item;
  }

  async removeNavigation(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    const before = await this.navigationItem(id);
    const children = await this.prisma.navigationItem.count({
      where: { parentId: id, deletedAt: null },
    });
    if (children) throw new ConflictException("请先处理该菜单下的子菜单");
    await this.prisma.navigationItem.update({
      where: { id },
      data: { deletedAt: new Date(), isEnabled: false, updatedById: actorId },
    });
    await this.audit.record({
      actorId,
      action: "delete",
      resourceType: "navigation",
      resourceId: id,
      beforeData: before,
      meta,
    });
  }

  async sortNavigation(
    dto: SortContentItemsDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    const ids = dto.items.map(({ id }) => BigInt(id));
    if (new Set(dto.items.map(({ id }) => id)).size !== ids.length)
      throw new BadRequestException("排序列表包含重复 ID");
    const count = await this.prisma.navigationItem.count({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (count !== ids.length) throw new NotFoundException("部分导航菜单不存在");
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.navigationItem.update({
          where: { id: BigInt(item.id) },
          data: { sortOrder: item.sortOrder, updatedById: actorId },
        }),
      ),
    );
    await this.audit.record({
      actorId,
      action: "sort",
      resourceType: "navigation",
      afterData: dto.items,
      meta,
    });
  }

  async pages(query: PageQueryDto): Promise<unknown> {
    const deleted = query.deleted === "true";
    const where: Prisma.PageWhereInput = {
      deletedAt: deleted ? { not: null } : null,
      status: query.status,
      ...(query.keyword
        ? {
            OR: [
              { titleZh: { contains: query.keyword } },
              { titleEn: { contains: query.keyword } },
              { slug: { contains: query.keyword } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.page.findMany({
        where,
        include: pageInclude,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.page.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  async page(id: bigint): Promise<unknown> {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: pageInclude,
    });
    if (!page) throw new NotFoundException("页面不存在");
    return page;
  }

  async createPage(
    dto: CreatePageDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedPage(dto);
    const ogMediaId = dto.ogMediaId ? BigInt(dto.ogMediaId) : null;
    if (ogMediaId) await this.assertMedia(ogMediaId);
    const slug = await this.nextPageSlug(this.pageSlugBase(dto));
    const page = await this.prisma.page.create({
      data: {
        ...this.pageData(dto),
        slug,
        titleZh: sanitizePlainText(dto.titleZh)!,
        titleEn: sanitizePlainText(dto.titleEn ?? dto.titleZh)!,
        content: this.content(dto),
        status: dto.status,
        publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null,
        ogMediaId,
        createdById: actorId,
        updatedById: actorId,
      } as Prisma.PageUncheckedCreateInput,
      include: pageInclude,
    });
    await this.audit.record({
      actorId,
      action: "create",
      resourceType: "page",
      resourceId: page.id,
      afterData: page,
      meta,
    });
    return page;
  }

  async updatePage(
    id: bigint,
    dto: UpdatePageDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    dto = await this.localizedPage(dto);
    const before = await this.activePage(id);
    const ogMediaId = dto.ogMediaId
      ? BigInt(dto.ogMediaId)
      : dto.ogMediaId === null
        ? null
        : undefined;
    if (ogMediaId) await this.assertMedia(ogMediaId);
    const current = before.content as Record<string, string>;
    const content =
      dto.contentZh !== undefined ||
      dto.contentEn !== undefined ||
      dto.contentRu !== undefined
        ? this.content(dto, current)
        : undefined;
    const page = await this.prisma.page.update({
      where: { id },
      data: {
        ...this.pageData(dto),
        content,
        status: dto.status,
        publishedAt:
          dto.status === ContentStatus.PUBLISHED && !before.publishedAt
            ? new Date()
            : undefined,
        ogMediaId,
        updatedById: actorId,
      },
      include: pageInclude,
    });
    await this.audit.record({
      actorId,
      action: "update",
      resourceType: "page",
      resourceId: id,
      beforeData: before,
      afterData: page,
      meta,
    });
    return page;
  }

  async publishPage(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.activePage(id);
    const page = await this.prisma.page.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        updatedById: actorId,
      },
      include: pageInclude,
    });
    await this.audit.record({
      actorId,
      action: "publish",
      resourceType: "page",
      resourceId: id,
      beforeData: before,
      afterData: page,
      meta,
    });
    return page;
  }

  async removePage(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<void> {
    const before = await this.activePage(id);
    await this.prisma.page.update({
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
      resourceType: "page",
      resourceId: id,
      beforeData: before,
      meta,
    });
  }

  async restorePage(
    id: bigint,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.prisma.page.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    if (!before) throw new NotFoundException("回收站中不存在该页面");
    const page = await this.prisma.page.update({
      where: { id },
      data: {
        deletedAt: null,
        status: ContentStatus.DRAFT,
        publishedAt: null,
        updatedById: actorId,
      },
      include: pageInclude,
    });
    await this.audit.record({
      actorId,
      action: "restore",
      resourceType: "page",
      resourceId: id,
      beforeData: before,
      afterData: page,
      meta,
    });
    return page;
  }

  private pageData(dto: UpdatePageDto): Prisma.PageUncheckedUpdateInput {
    return {
      titleZh: sanitizePlainText(dto.titleZh),
      titleEn: sanitizePlainText(dto.titleEn),
      titleRu: sanitizePlainText(dto.titleRu),
      summaryZh: sanitizePlainText(dto.summaryZh),
      summaryEn: sanitizePlainText(dto.summaryEn),
      summaryRu: sanitizePlainText(dto.summaryRu),
      seoTitle: sanitizePlainText(dto.seoTitle),
      seoKeywords: sanitizePlainText(dto.seoKeywords),
      seoDescription: sanitizePlainText(dto.seoDescription),
    };
  }

  private pageSlugBase(dto: CreatePageDto): string {
    const source =
      dto.slug?.trim() || dto.titleEn?.trim() || dto.titleZh.trim();
    const slug = source
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 191);
    if (slug) return slug;
    return `page-${createHash("sha256")
      .update(`${dto.titleZh}:${dto.titleEn ?? ""}`)
      .digest("hex")
      .slice(0, 16)}`;
  }

  private async localizedPage<T extends CreatePageDto | UpdatePageDto>(
    dto: T,
  ): Promise<T> {
    return applyLocalizedFields(dto, this.translation, pageTranslationFields);
  }

  private async nextPageSlug(base: string): Promise<string> {
    for (let index = 1; index <= 10_000; index += 1) {
      const suffix = index === 1 ? "" : `-${index}`;
      const slug = `${base.slice(0, 191 - suffix.length)}${suffix}`;
      const existing = await this.prisma.page.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) return slug;
    }
    throw new ConflictException("页面链接标识已达到可用上限");
  }

  private content(
    dto: UpdatePageDto,
    current: Record<string, string> = {},
  ): Prisma.InputJsonValue {
    return {
      zh: sanitizeRichText(dto.contentZh) ?? current.zh ?? "",
      en: sanitizeRichText(dto.contentEn) ?? current.en ?? "",
      ru: sanitizeRichText(dto.contentRu) ?? current.ru ?? "",
    };
  }

  private async navigationItem(id: bigint) {
    const item = await this.prisma.navigationItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw new NotFoundException("导航菜单不存在");
    return item;
  }

  private async assertTopLevelParent(id: bigint): Promise<void> {
    const parent = await this.prisma.navigationItem.findFirst({
      where: { id, parentId: null, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new BadRequestException("父级菜单不存在或已是二级菜单");
  }

  private assertHref(href: string): void {
    if (!/^\/(?!\/)|^https?:\/\//i.test(href))
      throw new BadRequestException("导航链接必须是站内路径或 HTTP(S) 链接");
  }

  private async activePage(id: bigint) {
    const page = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
      include: pageInclude,
    });
    if (!page) throw new NotFoundException("页面不存在");
    return page;
  }

  private async assertMedia(id: bigint): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id, status: MediaAssetStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });
    if (!media) throw new NotFoundException("页面分享图片素材不存在");
  }
}
