import { Prisma } from '@prisma/client';
import { CatalogService } from './catalog.service';

function createService() {
  const prisma = {
    brand: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  return {
    service: new CatalogService(prisma as never, audit as never),
    prisma,
    audit,
  };
}

describe('CatalogService quickCreateBrand', () => {
  it('creates a reusable brand from a single custom name', async () => {
    const { service, prisma, audit } = createService();
    prisma.brand.findFirst.mockResolvedValue(null);
    prisma.brand.findUnique.mockResolvedValue(null);
    prisma.brand.create.mockResolvedValue({
      id: 7n,
      nameZh: 'Toyota',
      nameEn: 'Toyota',
      slug: 'toyota',
      isEnabled: true,
    });

    const brand = await service.quickCreateBrand({ name: '  Toyota  ' }, 1n, {} as never);

    expect(brand).toMatchObject({ id: 7n, slug: 'toyota' });
    const createCalls = prisma.brand.create.mock.calls as unknown as Array<[unknown]>;
    expect(createCalls[0]?.[0]).toMatchObject({
      data: {
        nameZh: 'Toyota',
        nameEn: 'Toyota',
        slug: 'toyota',
        isEnabled: true,
        createdById: 1n,
        updatedById: 1n,
      },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resourceType: 'brand',
      resourceId: 7n,
    }));
  });

  it('returns an existing active brand instead of creating a duplicate', async () => {
    const { service, prisma, audit } = createService();
    const existing = { id: 8n, nameZh: 'Toyota', nameEn: 'Toyota', isEnabled: true };
    prisma.brand.findFirst.mockResolvedValue(existing);

    await expect(service.quickCreateBrand({ name: 'Toyota' }, 1n, {} as never)).resolves.toBe(existing);

    expect(prisma.brand.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('returns the concurrently created brand when its deterministic slug collides', async () => {
    const { service, prisma, audit } = createService();
    const concurrent = { id: 9n, nameZh: 'Toyota', nameEn: 'Toyota', isEnabled: true };
    prisma.brand.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrent);
    prisma.brand.findUnique.mockResolvedValue(null);
    prisma.brand.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.0',
      }),
    );

    await expect(service.quickCreateBrand({ name: 'Toyota' }, 1n, {} as never)).resolves.toBe(concurrent);

    expect(audit.record).not.toHaveBeenCalled();
  });
});
