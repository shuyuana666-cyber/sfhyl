import type { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { MediaAssetStatus, StorageDriver } from '@prisma/client';
import sharp from 'sharp';
import type { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../common/utils/request-meta';
import type { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { StorageProvider } from '../infrastructure/storage/storage-provider';
import type { UploadMediaDto } from './dto/upload-media.dto';
import type { FileValidationService } from './file-validation.service';
import { MediaService } from './media.service';
import type { StorageRegistry } from '../infrastructure/storage/storage-registry';
import { MediaProcessingService } from './media-processing.service';

function config(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('MediaService', () => {
  const deletableAsset = (id = 77n) => ({
    id,
    driver: StorageDriver.LOCAL,
    bucket: null,
    objectKey: `2026/10/${id}.webp`,
    thumbnailObjectKey: `2026/10/${id}.thumb.webp`,
    webpObjectKey: `2026/10/${id}.webp`,
    deletedAt: null,
    _count: {},
  });

  function deletionFixture(assets = [deletableAsset()]) {
    const mediaAsset = {
      findUnique: jest.fn(async ({ where }: { where: { id: bigint } }) => assets.find(asset => asset.id === where.id)),
      delete: jest.fn(async () => undefined),
    };
    const prisma = { mediaAsset, page: { findFirst: jest.fn(async () => null) } } as unknown as PrismaService;
    const deleteObject = jest.fn(async (key: string, bucket?: string | null) => {
      void key;
      void bucket;
    });
    const storage = { driver: StorageDriver.LOCAL, deleteObject } as unknown as StorageProvider;
    const service = new MediaService(prisma, storage, {} as FileValidationService,
      { record: jest.fn(async () => undefined) } as unknown as AuditService, config({}));
    return { service, mediaAsset, prisma, storage, deleteObject };
  }

  it('permanently deletes active media and all unique stored files without archiving first', async () => {
    const { service, mediaAsset, deleteObject } = deletionFixture();
    await service.permanentlyRemove(77n, 1n, {} as RequestMeta);
    expect(deleteObject.mock.calls).toEqual([
      ['2026/10/77.webp', null], ['2026/10/77.thumb.webp', null],
    ]);
    expect(mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 77n } });
  });

  it('retains the asset record if deleting stored files fails', async () => {
    const { service, mediaAsset, deleteObject } = deletionFixture();
    deleteObject.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(service.permanentlyRemove(77n, 1n, {} as RequestMeta)).rejects.toThrow('Storage unavailable');
    expect(mediaAsset.delete).not.toHaveBeenCalled();
  });

  it('checks every selected reference before any batch deletion', async () => {
    const assets = [deletableAsset(77n), { ...deletableAsset(78n), _count: { vehicleCovers: 1 } }];
    const { service, mediaAsset, deleteObject } = deletionFixture(assets);
    await expect(service.batchAction({ ids: ['77', '78'], action: 'DELETE' }, 1n, {} as RequestMeta))
      .rejects.toBeInstanceOf(ConflictException);
    expect(deleteObject).not.toHaveBeenCalled();
    expect(mediaAsset.delete).not.toHaveBeenCalled();
  });

  it('permanently deletes each unique selected asset in a batch', async () => {
    const { service, mediaAsset, deleteObject } = deletionFixture([deletableAsset(77n), deletableAsset(78n)]);
    await expect(service.batchAction({ ids: ['77', '78', '77'], action: 'DELETE' }, 1n, {} as RequestMeta))
      .resolves.toEqual({ affected: 2 });
    expect(mediaAsset.delete).toHaveBeenCalledTimes(2);
    expect(deleteObject).toHaveBeenCalledTimes(4);
  });

  it('deletes from the original storage driver and bucket after the current driver changes', async () => {
    const { prisma, storage, deleteObject } = deletionFixture();
    const originalDelete = jest.fn(async () => undefined);
    const asset = { ...deletableAsset(), driver: StorageDriver.MINIO, bucket: 'original-bucket' };
    jest.spyOn(prisma.mediaAsset, 'findUnique').mockResolvedValue(asset as never);
    const forDriver = jest.fn(() => ({ deleteObject: originalDelete }));
    const service = new MediaService(prisma, storage, {} as FileValidationService,
      { record: jest.fn(async () => undefined) } as unknown as AuditService, config({}),
      {} as MediaProcessingService, { forDriver } as unknown as StorageRegistry);
    await service.permanentlyRemove(77n, 1n, {} as RequestMeta);
    expect(forDriver).toHaveBeenCalledWith(StorageDriver.MINIO);
    expect(originalDelete).toHaveBeenCalledWith(asset.objectKey, 'original-bucket');
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('moves a referenced asset by changing only folder metadata and retaining public URLs', async () => {
    const before = { ...deletableAsset(), folderId: null, url: '/uploads/77.webp', thumbnailUrl: '/uploads/77.thumb.webp' };
    const update = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...before, ...data }));
    const service = new MediaService({ mediaAsset: { findFirst: jest.fn(async () => before), update },
      mediaFolder: { findFirst: jest.fn(async () => ({ id: 9n })) } } as unknown as PrismaService,
      {} as StorageProvider, {} as FileValidationService,
      { record: jest.fn(async () => undefined) } as unknown as AuditService, config({}));
    const moved = await service.update(77n, { folderId: '9' }, 1n, {} as RequestMeta);
    expect(moved).toMatchObject({ id: 77n, folderId: 9n, objectKey: before.objectKey,
      url: before.url, thumbnailUrl: before.thumbnailUrl });
    const data = update.mock.calls[0]?.[0].data;
    expect(data).not.toHaveProperty('url');
    expect(data).not.toHaveProperty('objectKey');
  });

  it('removes a nonempty folder and reparents its assets, records and children without changing file URLs', async () => {
    const transaction = {
      mediaAsset: { updateMany: jest.fn(async () => ({ count: 2 })) },
      mediaUploadRecord: { updateMany: jest.fn(async () => ({ count: 2 })) },
      mediaFolder: {
        findMany: jest.fn(async ({ where }: { where: { parentId: bigint | null } }) => where.parentId === 7n
          ? [{ id: 8n, slug: 'photos', name: 'Photos' }] : [{ slug: 'photos' }, { slug: 'photos-2' }]),
        update: jest.fn(async () => undefined),
      },
    };
    const prisma = {
      mediaFolder: { findFirst: jest.fn(async () => ({ id: 7n, parentId: 3n, _count: { assets: 2, children: 1 } })) },
      $transaction: jest.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    } as unknown as PrismaService;
    const service = new MediaService(prisma, {} as StorageProvider, {} as FileValidationService,
      { record: jest.fn(async () => undefined) } as unknown as AuditService, config({}));
    await service.removeFolder(7n, 1n, {} as RequestMeta);
    expect(transaction.mediaAsset.updateMany).toHaveBeenCalledWith({ where: { folderId: 7n }, data: { folderId: 3n, updatedById: 1n } });
    expect(transaction.mediaFolder.update).toHaveBeenCalledWith({ where: { id: 8n }, data: { parentId: 3n, slug: 'photos-3', updatedById: 1n } });
  });

  it('clears all upload history independently of asset storage', async () => {
    const deleteMany = jest.fn(async () => ({ count: 42 }));
    const service = new MediaService({ mediaUploadRecord: { deleteMany } } as unknown as PrismaService,
      {} as StorageProvider, {} as FileValidationService,
      { record: jest.fn(async () => undefined) } as unknown as AuditService, config({}));
    await expect(service.clearUploads(1n, {} as RequestMeta)).resolves.toEqual({ affected: 42 });
    expect(deleteMany).toHaveBeenCalledWith({});
  });

  it('converts uploads to WebP even if their processing history was cleared before completion', async () => {
    const onePixelPng = await sharp({
      create: { width: 1, height: 1, channels: 4, background: '#d73027' },
    })
      .png()
      .toBuffer();
    const storedInputs: Array<{ objectKey: string; mimeType: string }> = [];
    const storage = {
      driver: StorageDriver.LOCAL,
      putObject: jest.fn(async (input: { objectKey: string; mimeType: string }) => {
        storedInputs.push(input);
        return {
          driver: StorageDriver.LOCAL,
          bucket: null,
          objectKey: input.objectKey,
          url: `https://media.example/${input.objectKey}`,
        };
      }),
      deleteObject: jest.fn(async () => undefined),
    } as unknown as StorageProvider;
    const mediaAsset = {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 1n,
        ...data,
      })),
    };
    const mediaUploadRecord = {
      create: jest.fn(async () => ({ id: 10n })),
      updateMany: jest.fn(async () => ({ count: 0 })),
    };
    type TransactionClient = {
      mediaAsset: typeof mediaAsset;
      mediaUploadRecord: typeof mediaUploadRecord;
    };
    const prisma = {
      mediaAsset,
      mediaUploadRecord,
      $transaction: jest.fn(async (callback: (client: TransactionClient) => Promise<unknown>) =>
        callback({ mediaAsset, mediaUploadRecord }),
      ),
    } as unknown as PrismaService;
    const validation = {
      validate: jest.fn(async () => ({
        content: onePixelPng,
        mimeType: 'image/png',
        extension: 'png',
        originalName: 'test.png',
        width: 1,
        height: 1,
      })),
    } as unknown as FileValidationService;
    const recordAudit = jest.fn(async () => undefined);
    const audit = { record: recordAudit } as unknown as AuditService;
    const service = new MediaService(
      prisma,
      storage,
      validation,
      audit,
      config({ MEDIA_THUMBNAIL_WIDTH: 320 }),
    );

    const asset = await service.upload(
      { originalname: 'test.png' } as Express.Multer.File,
      {} as UploadMediaDto,
      1n,
      {} as RequestMeta,
    );

    expect(storedInputs).toHaveLength(2);
    expect(storedInputs[0]?.objectKey).toMatch(/\.webp$/);
    expect(storedInputs[0]?.mimeType).toBe('image/webp');
    expect(storedInputs[1]?.objectKey).toMatch(/\.thumb\.webp$/);
    const result = asset as {
      url?: string;
      thumbnailUrl?: string;
      webpUrl?: string;
      extension?: string;
      mimeType?: string;
      originalName?: string;
    };
    expect(result.thumbnailUrl).toMatch(/\.thumb\.webp$/);
    expect(result.webpUrl).toMatch(/\.webp$/);
    expect(result.webpUrl).toBe(result.url);
    expect(result.extension).toBe('webp');
    expect(result.mimeType).toBe('image/webp');
    expect(result.originalName).toBe('test.webp');
    expect(mediaUploadRecord.updateMany).toHaveBeenCalledTimes(1);
  });

  it('persists a failed upload record when validation rejects a file', async () => {
    const updates: unknown[] = [];
    const prisma = {
      mediaUploadRecord: {
        create: jest.fn(async () => ({ id: 11n })),
        updateMany: jest.fn(async (input: unknown) => {
          updates.push(input);
        }),
      },
    } as unknown as PrismaService;
    const validation = {
      validate: jest.fn(async () => {
        throw new BadRequestException('Invalid file');
      }),
    } as unknown as FileValidationService;
    const service = new MediaService(
      prisma,
      {} as StorageProvider,
      validation,
      { record: jest.fn(async () => undefined) } as unknown as AuditService,
      config({}),
    );

    await expect(
      service.upload(
        { originalname: 'invalid.exe', mimetype: 'application/octet-stream', size: 12 } as Express.Multer.File,
        {} as UploadMediaDto,
        1n,
        {} as RequestMeta,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updates).toHaveLength(1);
  });

  it('uses a normalized filename for the upload record before validation runs', async () => {
    const created: Array<{ data: { originalName: string } }> = [];
    const prisma = {
      mediaUploadRecord: {
        create: jest.fn(async (input: { data: { originalName: string } }) => {
          created.push(input);
          return { id: 12n };
        }),
        updateMany: jest.fn(async () => undefined),
      },
    } as unknown as PrismaService;
    const validation = {
      validate: jest.fn(async () => {
        throw new BadRequestException('Invalid file');
      }),
    } as unknown as FileValidationService;
    const service = new MediaService(
      prisma,
      {} as StorageProvider,
      validation,
      { record: jest.fn(async () => undefined) } as unknown as AuditService,
      config({}),
    );
    const originalName = '截图 2026-07-28.png';
    const multerName = Buffer.from(originalName, 'utf8').toString('latin1');

    await expect(
      service.upload(
        { originalname: multerName, mimetype: 'image/png', size: 12 } as Express.Multer.File,
        {} as UploadMediaDto,
        1n,
        {} as RequestMeta,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(created).toHaveLength(1);
    expect(created[0]?.data.originalName).toBe(originalName);
  });

  it('generates an internal unique slug when creating a folder', async () => {
    const mediaFolder = {
      findMany: jest.fn(async () => [{ slug: 'folder' }, { slug: 'folder-2' }]),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 5n, ...data })),
    };
    const prisma = { mediaFolder } as unknown as PrismaService;
    const recordAudit = jest.fn(async () => undefined);
    const audit = { record: recordAudit } as unknown as AuditService;
    const service = new MediaService(
      prisma,
      {} as StorageProvider,
      {} as FileValidationService,
      audit,
      config({}),
    );

    await service.createFolder({ name: '轮播图' }, 1n, {} as RequestMeta);

    expect(mediaFolder.create).toHaveBeenCalledWith({
      data: {
        parentId: null,
        name: '轮播图',
        slug: 'folder-3',
        createdById: 1n,
        updatedById: 1n,
      },
    });
    expect(recordAudit.mock.calls).toHaveLength(1);
  });

  it('limits the unfiled-media view to assets without a folder', async () => {
    const mediaAsset = {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    };
    const prisma = {
      mediaAsset,
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    } as unknown as PrismaService;
    const service = new MediaService(
      prisma,
      {} as StorageProvider,
      {} as FileValidationService,
      { record: jest.fn(async () => undefined) } as unknown as AuditService,
      config({}),
    );

    await service.list({
      page: 1,
      pageSize: 24,
      deleted: 'false',
      unfiled: 'true',
    });

    const findManyCalls = mediaAsset.findMany.mock.calls as unknown as Array<[unknown]>;
    expect(findManyCalls[0]?.[0]).toMatchObject({
      where: {
        deletedAt: null,
        status: MediaAssetStatus.ACTIVE,
        folderId: null,
      },
    });
  });

  it('moves selected active assets to the chosen folder in one batch', async () => {
    const mediaAsset = {
      findMany: jest.fn(async () => [{ id: 10n }, { id: 11n }]),
      updateMany: jest.fn(async () => ({ count: 2 })),
    };
    const recordAudit = jest.fn(async () => undefined);
    const audit = { record: recordAudit } as unknown as AuditService;
    const service = new MediaService(
      { mediaAsset } as unknown as PrismaService,
      {} as StorageProvider,
      {} as FileValidationService,
      audit,
      config({}),
    );

    await expect(
      service.batchAction(
        { ids: ['10', '11'], action: 'MOVE', folderId: null },
        1n,
        {} as RequestMeta,
      ),
    ).resolves.toEqual({ affected: 2 });

    expect(mediaAsset.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [10n, 11n] },
        deletedAt: null,
        status: MediaAssetStatus.ACTIVE,
      },
      data: { folderId: null, updatedById: 1n },
    });
    const auditCalls = recordAudit.mock.calls as unknown as Array<[Record<string, unknown>]>;
    expect(auditCalls[0]?.[0]).toMatchObject({
      action: 'batch_move',
      resourceType: 'media_asset',
    });
  });

  it('does not permanently delete an asset referenced by managed homepage content', async () => {
    const mediaAsset = {
      findUnique: jest.fn(async () => ({
        id: 88n,
        objectKey: '2026/08/hero.webp',
        thumbnailObjectKey: null,
        webpObjectKey: null,
        deletedAt: new Date(),
        _count: {},
      })),
      delete: jest.fn(),
    };
    const prisma = {
      mediaAsset,
      page: {
        findFirst: jest.fn(async () => ({
          content: {
            managed: true,
            hero: [{ imageMediaId: '88' }],
          },
        })),
      },
    } as unknown as PrismaService;
    const deleteObject = jest.fn(async () => undefined);
    const storage = { deleteObject } as unknown as StorageProvider;
    const service = new MediaService(
      prisma,
      storage,
      {} as FileValidationService,
      { record: jest.fn(async () => undefined) } as unknown as AuditService,
      config({}),
    );

    await expect(
      service.permanentlyRemove(88n, 1n, {} as RequestMeta),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(deleteObject.mock.calls).toHaveLength(0);
    expect(mediaAsset.delete).not.toHaveBeenCalled();
  });

  it('does not archive an asset referenced by managed homepage content', async () => {
    const mediaAsset = {
      findFirst: jest.fn(async () => ({ id: 88n, _count: {} })),
      update: jest.fn(),
    };
    const prisma = {
      mediaAsset,
      page: {
        findFirst: jest.fn(async () => ({
          content: {
            managed: true,
            staff: { items: [{ imageMediaId: '88' }] },
          },
        })),
      },
    } as unknown as PrismaService;
    const service = new MediaService(
      prisma,
      {} as StorageProvider,
      {} as FileValidationService,
      { record: jest.fn(async () => undefined) } as unknown as AuditService,
      config({}),
    );

    await expect(
      service.remove(88n, 1n, {} as RequestMeta),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mediaAsset.update).not.toHaveBeenCalled();
  });
});
