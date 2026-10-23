import { VehiclesService } from './vehicles.service';
import type { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';

function vehicleDto(overrides: Partial<CreateVehicleDto> = {}): CreateVehicleDto {
  return {
    stockNo: 'SF-001',
    type: 'NEW',
    nameZh: '丰田卡罗拉',
    nameEn: 'Toyota Corolla',
    brandId: '1',
    year: 2025,
    price: '100000',
    ...overrides,
  } as CreateVehicleDto;
}

function createService() {
  const transaction = {
    vehicle: {
      create: jest.fn().mockResolvedValue({ id: 1n }),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1n }),
    },
    vehicleTagRelation: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    vehicleMedia: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const prisma = {
    brand: { findFirst: jest.fn().mockResolvedValue({ id: 1n, isEnabled: true }) },
    mediaAsset: { count: jest.fn().mockResolvedValue(0) },
    vehicle: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  const audit = { record: jest.fn() };
  return {
    service: new VehiclesService(prisma as never, audit as never, {} as never),
    prisma,
    transaction,
  };
}

describe('VehiclesService generated slugs', () => {
  it('generates a slug from the vehicle name when the client omits it', async () => {
    const { service, prisma, transaction } = createService();
    prisma.vehicle.findUnique.mockResolvedValue(null);

    await service.create(vehicleDto(), 1n, {} as never);

    const createCalls = transaction.vehicle.create.mock.calls as unknown as Array<[unknown]>;
    expect(createCalls[0]?.[0]).toMatchObject({
      data: { slug: 'toyota-corolla' },
    });
  });

  it('adds a numeric suffix when the generated slug is already in use', async () => {
    const { service, prisma, transaction } = createService();
    prisma.vehicle.findUnique
      .mockResolvedValueOnce({ id: 2n })
      .mockResolvedValueOnce({ id: 3n })
      .mockResolvedValueOnce(null);

    await service.create(vehicleDto(), 1n, {} as never);

    const createCalls = transaction.vehicle.create.mock.calls as unknown as Array<[unknown]>;
    expect(createCalls[0]?.[0]).toMatchObject({
      data: { slug: 'toyota-corolla-3' },
    });
  });

  it('keeps the existing slug unchanged during edits', async () => {
    const { service, prisma, transaction } = createService();
    prisma.vehicle.findFirst
      .mockResolvedValueOnce({
        id: 1n,
        slug: 'toyota-corolla',
        brandId: 1n,
        seriesId: null,
        modelId: null,
        categoryId: null,
      })
      .mockResolvedValueOnce(null);

    await service.update(1n, { slug: 'replacement-slug' } as UpdateVehicleDto, 1n, {} as never);

    const updateCalls = transaction.vehicle.update.mock.calls as unknown as Array<[{
      data?: { slug?: string };
    }]>;
    expect(updateCalls[0]?.[0]?.data?.slug).toBeUndefined();
  });

  it('identifies a duplicate stock number before creating a vehicle', async () => {
    const { service, prisma } = createService();
    prisma.vehicle.findFirst.mockResolvedValue({ stockNo: 'SF-001', vin: null });

    await expect(service.create(vehicleDto(), 1n, {} as never)).rejects.toThrow(
      '库存编号“SF-001”已存在',
    );
  });

  it('generates the next date-based stock number when it is omitted', async () => {
    const { service, prisma, transaction } = createService();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const date = ['year', 'month', 'day'].map((part) => dateParts.find((item) => item.type === part)?.value).join('');
    prisma.vehicle.findMany.mockResolvedValue([
      { stockNo: `${date}-001` },
      { stockNo: `${date}-009` },
      { stockNo: 'LEGACY-100' },
    ]);
    prisma.vehicle.findUnique.mockResolvedValue(null);

    await service.create(vehicleDto({ stockNo: undefined }), 1n, {} as never);

    const createCalls = transaction.vehicle.create.mock.calls as unknown as Array<[unknown]>;
    expect(createCalls[0]?.[0]).toMatchObject({
      data: { stockNo: `${date}-010` },
    });
  });

  it('uses the first sorted image as the cover and ignores legacy cover fields', async () => {
    const { service, prisma, transaction } = createService();
    prisma.vehicle.findUnique.mockResolvedValue(null);
    prisma.mediaAsset.count.mockResolvedValue(2);
    transaction.vehicleMedia.findMany.mockResolvedValue([
      {
        id: 11n,
        mediaId: 22n,
        media: { mimeType: 'image/jpeg', status: 'ACTIVE', deletedAt: null },
      },
      {
        id: 12n,
        mediaId: 21n,
        media: { mimeType: 'image/jpeg', status: 'ACTIVE', deletedAt: null },
      },
    ]);

    await service.create(vehicleDto({
      coverMediaId: '21',
      media: [
        { mediaId: '22', sortOrder: 0 },
        { mediaId: '21', sortOrder: 1, isCover: true },
      ],
    }), 1n, {} as never);

    expect(transaction.vehicleMedia.update).toHaveBeenCalledWith({
      where: { id: 11n },
      data: { isCover: true },
    });
    const updateCalls = transaction.vehicle.update.mock.calls as unknown as Array<[unknown]>;
    expect(updateCalls[0]?.[0]).toMatchObject({
      where: { id: 1n },
      data: { coverMediaId: 22n },
    });
  });

  it('publishes an image-backed vehicle within the create transaction', async () => {
    const { service, prisma, transaction } = createService();
    prisma.vehicle.findUnique.mockResolvedValue(null);
    prisma.mediaAsset.count.mockResolvedValue(1);
    transaction.vehicleMedia.findMany.mockResolvedValue([
      {
        id: 11n,
        mediaId: 22n,
        media: { mimeType: 'image/webp', status: 'ACTIVE', deletedAt: null },
      },
    ]);

    await service.create(vehicleDto({
      publishNow: true,
      media: [{ mediaId: '22', sortOrder: 0 }],
    }), 1n, {} as never);

    const updateCalls = transaction.vehicle.update.mock.calls as unknown as Array<[unknown]>;
    expect(updateCalls.at(-1)?.[0]).toMatchObject({
      where: { id: 1n },
      data: {
        status: 'PUBLISHED',
        scheduledAt: null,
      },
    });
  });

  it('requires an image before publishing a vehicle', async () => {
    const { service, prisma, transaction } = createService();
    prisma.vehicle.findFirst.mockResolvedValue({ id: 1n, coverMediaId: null });
    transaction.vehicleMedia.findMany.mockResolvedValue([
      {
        id: 13n,
        mediaId: 23n,
        media: { mimeType: 'video/mp4', status: 'ACTIVE', deletedAt: null },
      },
    ]);

    await expect(service.publish(1n, 1n, {} as never)).rejects.toThrow(
      '发布车辆至少需要一张图片，系统会将排序最靠前的图片作为封面。',
    );
  });
});
