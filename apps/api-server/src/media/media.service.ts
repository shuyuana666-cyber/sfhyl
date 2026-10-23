import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { MediaAssetStatus, MediaUploadStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/interfaces/api-response';
import type { RequestMeta } from '../common/utils/request-meta';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { StorageProvider } from '../infrastructure/storage/storage-provider';
import { StorageRegistry } from '../infrastructure/storage/storage-registry';
import type { StoredObject } from '../infrastructure/storage/storage-provider';
import { homepageReferencesMedia } from '../content/homepage-content-utils';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { MediaQueryDto } from './dto/media-query.dto';
import type { MediaUploadQueryDto } from './dto/media-upload-query.dto';
import type { UploadMediaDto } from './dto/upload-media.dto';
import type { UpdateFolderDto, UpdateMediaDto } from './dto/update-media.dto';
import type { MediaBatchActionDto } from './dto/media-batch-action.dto';
import { FileValidationService, normalizeUploadFileName } from './file-validation.service';
import { MediaProcessingService } from './media-processing.service';

const MAX_FOLDER_SLUG_LENGTH = 120;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly validation: FileValidationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly processing: MediaProcessingService = new MediaProcessingService(config, storage),
    @Optional() private readonly storageRegistry?: StorageRegistry,
  ) {}

  async upload(
    file: Express.Multer.File,
    dto: UploadMediaDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    try {
      return await this.processUpload(file, dto, actorId, meta);
    } finally {
      if (file.path) await rm(file.path, { force: true }).catch(() => undefined);
    }
  }

  private async processUpload(
    file: Express.Multer.File,
    dto: UploadMediaDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const folderId = dto.folderId ? BigInt(dto.folderId) : null;
    const startedAt = Date.now();
    const uploadRecord = await this.prisma.mediaUploadRecord.create({
      data: {
        folderId,
        originalName: normalizeUploadFileName(file.originalname),
        mimeType: file.mimetype?.slice(0, 191) || null,
        sizeBytes: BigInt(file.size ?? 0),
        createdById: actorId,
      },
    });
    let stored: StoredObject | null = null;
    const derivatives: StoredObject[] = [];
    let asset: Prisma.MediaAssetGetPayload<Record<string, never>>;

    try {
      const validated = await this.validation.validate(file);
      const processed = await this.processing.convertToWebp(validated);
      if (folderId) await this.assertFolder(folderId);
      const now = new Date();
      const filename = `${randomUUID()}.${processed.extension}`;
      const objectKey = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${filename}`;
      const storedObject = await this.storage.putObject({
        objectKey,
        content: processed.content,
        mimeType: processed.mimeType,
      });
      stored = storedObject;
      const generated = await this.processing.storeDerivatives(processed, storedObject);
      derivatives.push(...generated.objects);
      asset = await this.prisma.$transaction(async transaction => {
        const created = await transaction.mediaAsset.create({
          data: {
            folderId,
            driver: storedObject.driver,
            bucket: storedObject.bucket,
            objectKey: storedObject.objectKey,
            url: storedObject.url,
            thumbnailObjectKey: generated.thumbnail?.objectKey,
            thumbnailUrl: generated.thumbnail?.url,
            webpObjectKey: generated.webp?.objectKey,
            webpUrl: generated.webp?.url,
            originalName: processed.originalName,
            filename,
            extension: processed.extension,
            mimeType: processed.mimeType,
            sizeBytes: BigInt(processed.content.length),
            width: processed.width,
            height: processed.height,
            checksum: createHash('sha256').update(processed.content).digest('hex'),
            altZh: dto.altZh,
            altEn: dto.altEn,
            altRu: dto.altRu,
            createdById: actorId,
            updatedById: actorId,
          },
        });
        await transaction.mediaUploadRecord.updateMany({
          where: { id: uploadRecord.id },
          data: {
            mediaAssetId: created.id,
            originalName: processed.originalName,
            mimeType: processed.mimeType,
            sizeBytes: BigInt(processed.content.length),
            status: MediaUploadStatus.SUCCEEDED,
            durationMs: Date.now() - startedAt,
            completedAt: new Date(),
          },
        });
        return created;
      });
    } catch (error) {
      await this.prisma.mediaUploadRecord
        .updateMany({
          where: { id: uploadRecord.id },
          data: {
            status: MediaUploadStatus.FAILED,
            errorMessage: this.uploadFailureMessage(error),
            durationMs: Date.now() - startedAt,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
      await Promise.all(
        [...derivatives, ...(stored ? [stored] : [])].map((item) =>
          this.storage.deleteObject(item.objectKey).catch(() => undefined),
        ),
      );
      throw error;
    }

    await this.audit.record({
      actorId,
      action: 'upload',
      resourceType: 'media_asset',
      resourceId: asset.id,
      afterData: asset,
      meta,
    });
    return asset;
  }

  async uploadMany(
    files: Express.Multer.File[],
    dto: UploadMediaDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown[]> {
    if (!files.length) throw new BadRequestException('请选择上传文件');
    const uploaded: unknown[] = [];
    try {
      for (const file of files) uploaded.push(await this.upload(file, dto, actorId, meta));
      return uploaded;
    } finally {
      await Promise.all(
        files
          .filter((file) => file.path)
          .map((file) => rm(file.path, { force: true }).catch(() => undefined)),
      );
    }
  }

  async list(query: MediaQueryDto): Promise<unknown> {
    const deleted = query.deleted === 'true';
    const where: Prisma.MediaAssetWhereInput = {
      deletedAt: deleted ? { not: null } : null,
      status: deleted ? MediaAssetStatus.ARCHIVED : MediaAssetStatus.ACTIVE,
      folderId:
        query.unfiled === 'true'
          ? null
          : query.folderId
            ? BigInt(query.folderId)
            : undefined,
      mimeType: query.mimeGroup ? { startsWith: `${query.mimeGroup}/` } : undefined,
      createdAt:
        query.createdFrom || query.createdTo
          ? {
              gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
              lte: query.createdTo ? this.endOfDate(query.createdTo) : undefined,
            }
          : undefined,
      ...(query.keyword
        ? {
            OR: [
              { originalName: { contains: query.keyword } },
              { filename: { contains: query.keyword } },
              { objectKey: { contains: query.keyword } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        include: {
          folder: true,
          _count: { select: { brandLogos: true, pageOgImages: true, homepageBackgrounds: true, bannerDesktopImages: true, bannerMobileImages: true, featureImages: true, vehicleCovers: true, vehicleMedia: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  async batchAction(
    dto: MediaBatchActionDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<{ affected: number }> {
    const ids = [...new Set(dto.ids.map(value => BigInt(value)))];
    if (!ids.length) throw new BadRequestException('请选择素材');

    if (dto.action === 'DELETE') {
      // Validate all references before removing any selected file.
      const assets = await Promise.all(ids.map(id => this.assertPermanentlyDeletable(id)));
      for (const asset of assets) {
        await this.deleteAssetFiles(asset);
        await this.prisma.mediaAsset.delete({ where: { id: asset.id } });
        await this.audit.record({ actorId, action: 'permanent_delete', resourceType: 'media_asset', resourceId: asset.id, beforeData: asset, meta });
      }
      return { affected: assets.length };
    }

    const folderId = dto.folderId ? BigInt(dto.folderId) : null;
    if (dto.action === 'MOVE' && folderId) await this.assertFolder(folderId);

    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, deletedAt: null, status: MediaAssetStatus.ACTIVE },
      select: { id: true },
    });
    if (assets.length !== ids.length) throw new NotFoundException('部分素材不存在或已进入回收站');

    if (dto.action === 'ARCHIVE') {
      const homepage = await this.prisma.page.findFirst({
        where: { slug: 'homepage-content', deletedAt: null },
        select: { content: true },
      });
      if (ids.some(id => homepageReferencesMedia(homepage?.content, id))) {
        throw new ConflictException('选中的素材中有首页正在使用的文件，无法批量移入回收站');
      }
    }

    const result = await this.prisma.mediaAsset.updateMany({
      where: { id: { in: ids }, deletedAt: null, status: MediaAssetStatus.ACTIVE },
      data: dto.action === 'MOVE'
        ? { folderId, updatedById: actorId }
        : { status: MediaAssetStatus.ARCHIVED, deletedAt: new Date(), updatedById: actorId },
    });
    await this.audit.record({
      actorId,
      action: dto.action === 'MOVE' ? 'batch_move' : 'batch_archive',
      resourceType: 'media_asset',
      summary: `${dto.action === 'MOVE' ? 'Moved' : 'Archived'} ${result.count} media assets`,
      afterData: { ids: ids.map(String), folderId: folderId?.toString() ?? null },
      meta,
    });
    return { affected: result.count };
  }

  async listUploads(query: MediaUploadQueryDto): Promise<unknown> {
    const where: Prisma.MediaUploadRecordWhereInput = {
      status: query.status,
      createdById: query.createdById ? BigInt(query.createdById) : undefined,
      createdAt:
        query.createdFrom || query.createdTo
          ? {
              gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
              lte: query.createdTo ? this.endOfDate(query.createdTo) : undefined,
            }
          : undefined,
      ...(query.keyword
        ? { originalName: { contains: query.keyword } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaUploadRecord.findMany({
        where,
        include: {
          mediaAsset: { select: { id: true, url: true, thumbnailUrl: true } },
          createdBy: { select: { id: true, username: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.mediaUploadRecord.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  async clearUploads(actorId: bigint, meta: RequestMeta): Promise<{ affected: number }> {
    const result = await this.prisma.mediaUploadRecord.deleteMany({});
    await this.audit.record({ actorId, action: 'clear', resourceType: 'media_upload_record',
      summary: `Cleared ${result.count} upload records`, afterData: { affected: result.count }, meta });
    return { affected: result.count };
  }

  folders(): Promise<unknown> {
    return this.prisma.mediaFolder.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { assets: true, children: { where: { deletedAt: null } } } } },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createFolder(dto: CreateFolderDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const parentId = dto.parentId ? BigInt(dto.parentId) : null;
    if (parentId) await this.assertFolder(parentId);
    const slug = await this.nextFolderSlug(parentId, dto.name);
    const folder = await this.prisma.mediaFolder.create({
      data: { parentId, name: dto.name.trim(), slug, createdById: actorId, updatedById: actorId },
    });
    await this.audit.record({ actorId, action: 'create', resourceType: 'media_folder', resourceId: folder.id, afterData: folder, meta });
    return folder;
  }

  async updateFolder(id: bigint, dto: UpdateFolderDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.mediaFolder.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('素材文件夹不存在');
    const parentId = dto.parentId ? BigInt(dto.parentId) : dto.parentId === null ? null : undefined;
    if (parentId === id) throw new BadRequestException('文件夹不能选择自己作为父级');
    if (parentId) await this.assertFolder(parentId);
    if (parentId) {
      const descendants = await this.descendantIds(id);
      if (descendants.some((descendant) => descendant === parentId)) throw new BadRequestException('文件夹不能移动到自己的子级下');
    }
    const folder = await this.prisma.mediaFolder.update({
      where: { id },
      data: { parentId, name: dto.name?.trim(), updatedById: actorId },
    });
    await this.audit.record({ actorId, action: 'update', resourceType: 'media_folder', resourceId: id, beforeData: before, afterData: folder, meta });
    return folder;
  }

  async removeFolder(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const before = await this.prisma.mediaFolder.findFirst({
      where: { id, deletedAt: null }, include: { _count: { select: { assets: true, children: { where: { deletedAt: null } } } } },
    });
    if (!before) throw new NotFoundException('素材文件夹不存在');
    // Dissolve the directory without changing object keys or page references.
    await this.prisma.$transaction(async transaction => {
      await transaction.mediaAsset.updateMany({ where: { folderId: id }, data: { folderId: before.parentId, updatedById: actorId } });
      await transaction.mediaUploadRecord.updateMany({ where: { folderId: id }, data: { folderId: before.parentId } });
      const children = await transaction.mediaFolder.findMany({ where: { parentId: id, deletedAt: null } });
      const siblings = await transaction.mediaFolder.findMany({ where: { parentId: before.parentId }, select: { slug: true } });
      const usedSlugs = new Set(siblings.map(folder => folder.slug));
      for (const child of children) {
        let slug = child.slug;
        for (let suffix = 2; usedSlugs.has(slug); suffix++) {
          const ending = `-${suffix}`;
          slug = `${child.slug.slice(0, MAX_FOLDER_SLUG_LENGTH - ending.length)}${ending}`;
        }
        usedSlugs.add(slug);
        await transaction.mediaFolder.update({ where: { id: child.id }, data: { parentId: before.parentId, slug, updatedById: actorId } });
      }
      await transaction.mediaFolder.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actorId } });
    });
    await this.audit.record({ actorId, action: 'delete', resourceType: 'media_folder', resourceId: id, beforeData: before,
      afterData: { contentsMovedTo: before.parentId }, meta });
  }

  async update(id: bigint, dto: UpdateMediaDto, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('素材不存在');
    const folderId = dto.folderId ? BigInt(dto.folderId) : dto.folderId === null ? null : undefined;
    if (folderId) await this.assertFolder(folderId);
    const asset = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        folderId,
        originalName: dto.originalName?.trim(),
        altZh: dto.altZh,
        altEn: dto.altEn,
        altRu: dto.altRu,
        updatedById: actorId,
      },
      include: { folder: true },
    });
    await this.audit.record({ actorId, action: 'update', resourceType: 'media_asset', resourceId: id, beforeData: before, afterData: asset, meta });
    return asset;
  }

  async remove(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const homepage = await this.prisma.page.findFirst({
      where: { slug: 'homepage-content', deletedAt: null },
      select: { content: true },
    });
    if (homepageReferencesMedia(homepage?.content, id)) {
      throw new ConflictException('素材仍被首页内容引用，无法移入回收站');
    }
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            brandLogos: true,
            pageOgImages: true,
            homepageBackgrounds: true,
            bannerDesktopImages: true,
            bannerMobileImages: true,
            featureImages: true,
            vehicleCovers: true,
            vehicleMedia: true,
          },
        },
      },
    });
    if (!asset) throw new NotFoundException('素材不存在');
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { status: MediaAssetStatus.ARCHIVED, deletedAt: new Date(), updatedById: actorId },
    });
    await this.audit.record({ actorId, action: 'archive', resourceType: 'media_asset', resourceId: id, beforeData: asset, meta });
  }

  async restore(id: bigint, actorId: bigint, meta: RequestMeta): Promise<unknown> {
    const before = await this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: { not: null }, status: MediaAssetStatus.ARCHIVED } });
    if (!before) throw new NotFoundException('回收站中不存在该素材');
    const asset = await this.prisma.mediaAsset.update({
      where: { id }, data: { status: MediaAssetStatus.ACTIVE, deletedAt: null, updatedById: actorId }, include: { folder: true },
    });
    await this.audit.record({ actorId, action: 'restore', resourceType: 'media_asset', resourceId: id, beforeData: before, afterData: asset, meta });
    return asset;
  }

  async permanentlyRemove(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const asset = await this.assertPermanentlyDeletable(id);
    await this.deleteAssetFiles(asset);
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.audit.record({ actorId, action: 'permanent_delete', resourceType: 'media_asset', resourceId: id, beforeData: asset, meta });
  }

  private async assertPermanentlyDeletable(id: bigint) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id }, include: { _count: { select: {
      brandLogos: true, pageOgImages: true, homepageBackgrounds: true, bannerDesktopImages: true,
      bannerMobileImages: true, featureImages: true, vehicleCovers: true, vehicleMedia: true,
    } } } });
    if (!asset) throw new NotFoundException('素材不存在');
    if (Object.values(asset._count).some((count) => count > 0)) throw new ConflictException('素材仍被业务内容引用，不能永久删除');
    const homepage = await this.prisma.page.findFirst({
      where: { slug: 'homepage-content', deletedAt: null },
      select: { content: true },
    });
    if (homepageReferencesMedia(homepage?.content, id)) {
      throw new ConflictException('素材仍被首页内容引用，不能永久删除');
    }
    return asset;
  }

  private async deleteAssetFiles(asset: Prisma.MediaAssetGetPayload<Record<string, never>>): Promise<void> {
    const storage = this.storageRegistry?.forDriver(asset.driver) ?? this.storage;
    await Promise.all(
      [...new Set([asset.objectKey, asset.thumbnailObjectKey, asset.webpObjectKey])]
        .filter((objectKey): objectKey is string => Boolean(objectKey))
        .map((objectKey) => storage.deleteObject(objectKey, asset.bucket)),
    );
  }

  private async assertFolder(id: bigint): Promise<void> {
    const folder = await this.prisma.mediaFolder.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!folder) throw new NotFoundException('素材文件夹不存在');
  }

  private async descendantIds(id: bigint): Promise<bigint[]> {
    const descendants: bigint[] = [];
    let frontier = [id];
    while (frontier.length) {
      const children = await this.prisma.mediaFolder.findMany({ where: { parentId: { in: frontier }, deletedAt: null }, select: { id: true } });
      frontier = children.map(({ id: childId }) => childId);
      descendants.push(...frontier);
    }
    return descendants;
  }

  private async nextFolderSlug(parentId: bigint | null, name: string): Promise<string> {
    const base = this.folderSlugBase(name);
    const folders = await this.prisma.mediaFolder.findMany({
      where: { parentId, slug: { startsWith: base } },
      select: { slug: true },
    });
    const used = new Set(folders.map((folder) => folder.slug));
    if (!used.has(base)) return base;

    for (let suffix = 2; ; suffix += 1) {
      const suffixValue = `-${suffix}`;
      const candidate = `${base.slice(0, MAX_FOLDER_SLUG_LENGTH - suffixValue.length)}${suffixValue}`;
      if (!used.has(candidate)) return candidate;
    }
  }

  private folderSlugBase(name: string): string {
    const normalized = name
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_FOLDER_SLUG_LENGTH);
    return normalized || 'folder';
  }

  private endOfDate(value: string): Date {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private uploadFailureMessage(error: unknown): string {
    if (error instanceof Error) return error.message.slice(0, 1000);
    return 'Upload failed';
  }

}
