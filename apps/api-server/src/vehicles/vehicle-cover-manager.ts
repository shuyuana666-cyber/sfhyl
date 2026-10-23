import { MediaAssetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

const SYSTEM_SETTINGS_GROUP = 'system';
const VEHICLE_COVER_NORMALIZATION_KEY = 'vehicle_cover_sort_v1';

export class VehicleCoverManager {
  async normalizeOnce(prisma: PrismaService): Promise<void> {
    const marker = await prisma.siteSetting.findUnique({
      where: {
        group_key: {
          group: SYSTEM_SETTINGS_GROUP,
          key: VEHICLE_COVER_NORMALIZATION_KEY,
        },
      },
      select: { value: true },
    });
    if (this.isCompletedMarker(marker?.value)) return;

    const vehicles = await prisma.vehicle.findMany({ select: { id: true } });
    for (const vehicle of vehicles) {
      await prisma.$transaction((transaction) =>
        this.normalizeStoredCover(transaction, vehicle.id),
      );
    }

    const completedAt = new Date().toISOString();
    await prisma.siteSetting.upsert({
      where: {
        group_key: {
          group: SYSTEM_SETTINGS_GROUP,
          key: VEHICLE_COVER_NORMALIZATION_KEY,
        },
      },
      update: { value: { state: 'completed', completedAt } },
      create: {
        group: SYSTEM_SETTINGS_GROUP,
        key: VEHICLE_COVER_NORMALIZATION_KEY,
        value: { state: 'completed', completedAt },
        description: 'Vehicle cover normalization marker.',
        isPublic: false,
        isSensitive: false,
      },
    });
  }

  async synchronize(
    transaction: Prisma.TransactionClient,
    vehicleId: bigint,
    actorId?: bigint,
  ): Promise<bigint | null> {
    const media = await transaction.vehicleMedia.findMany({
      where: { vehicleId },
      include: {
        media: { select: { mimeType: true, status: true, deletedAt: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const cover = media.find((item) => this.isActiveImage(item.media));

    await transaction.vehicleMedia.updateMany({
      where: { vehicleId },
      data: { isCover: false },
    });
    if (cover) {
      await transaction.vehicleMedia.update({
        where: { id: cover.id },
        data: { isCover: true },
      });
    }
    await transaction.vehicle.update({
      where: { id: vehicleId },
      data: {
        coverMediaId: cover?.mediaId ?? null,
        ...(actorId ? { updatedById: actorId } : {}),
      },
    });
    return cover?.mediaId ?? null;
  }

  private async normalizeStoredCover(
    transaction: Prisma.TransactionClient,
    vehicleId: bigint,
  ): Promise<void> {
    const vehicle = await transaction.vehicle.findUnique({
      where: { id: vehicleId },
      select: { coverMediaId: true },
    });
    if (!vehicle) return;

    const media = await transaction.vehicleMedia.findMany({
      where: { vehicleId },
      include: {
        media: { select: { mimeType: true, status: true, deletedAt: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const preferredCover =
      media.find(
        (item) =>
          item.mediaId === vehicle.coverMediaId && this.isActiveImage(item.media),
      ) ?? media.find((item) => item.isCover && this.isActiveImage(item.media));

    if (preferredCover) {
      const ordered = [
        preferredCover,
        ...media.filter((item) => item.id !== preferredCover.id),
      ];
      for (const [index, item] of ordered.entries()) {
        await transaction.vehicleMedia.update({
          where: { id: item.id },
          data: { sortOrder: index },
        });
      }
    }

    await this.synchronize(transaction, vehicleId);
  }

  private isActiveImage(media: {
    mimeType: string;
    status: MediaAssetStatus;
    deletedAt: Date | null;
  }): boolean {
    return (
      media.status === MediaAssetStatus.ACTIVE &&
      !media.deletedAt &&
      media.mimeType.startsWith('image/')
    );
  }

  private isCompletedMarker(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).state === 'completed'
    );
  }
}
