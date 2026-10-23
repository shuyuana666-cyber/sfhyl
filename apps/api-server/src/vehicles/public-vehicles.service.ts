import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../common/interfaces/api-response';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { PublicVehicleQueryDto } from './dto/vehicle-query.dto';
import { LegacyVehicleImporterService } from './legacy-vehicle-importer.service';
import { buildPublicVehicleAvailability, buildPublicVehicleWhere } from './vehicle-query';

const publicVehicleSelect = {
  id: true,
  legacyId: true,
  stockNo: true,
  type: true,
  nameZh: true,
  nameEn: true,
  nameRu: true,
  slug: true,
  category: true,
  categoryId: true,
  year: true,
  price: true,
  originalPrice: true,
  currency: true,
  showPrice: true,
  showInquiryPrice: true,
  priceNote: true,
  mileage: true,
  mileageUnit: true,
  displacement: true,
  fuelType: true,
  transmission: true,
  driveType: true,
  bodyType: true,
  exteriorColor: true,
  interiorColor: true,
  location: true,
  shortDescriptionZh: true,
  shortDescriptionEn: true,
  shortDescriptionRu: true,
  saleStatus: true,
  isFeatured: true,
  isHomepage: true,
  isHot: true,
  publishedAt: true,
  seoTitle: true,
  seoKeywords: true,
  seoDescription: true,
  canonicalUrl: true,
  brand: true,
  series: true,
  model: true,
  categoryRef: true,
  coverMedia: true,
  tags: { include: { tag: true } },
} satisfies Prisma.VehicleSelect;

@Injectable()
export class PublicVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyVehicleImporter: LegacyVehicleImporterService,
  ) {}

  async list(query: PublicVehicleQueryDto): Promise<unknown> {
    await this.legacyVehicleImporter.ensure();
    const where = buildPublicVehicleWhere(query);
    const orderBy = { [query.sortBy]: query.sortOrder } as Prisma.VehicleOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        select: publicVehicleSelect,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  async detail(slug: string): Promise<unknown> {
    await this.legacyVehicleImporter.ensure();
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { slug, ...buildPublicVehicleAvailability() },
      select: {
        ...publicVehicleSelect,
        manufactureDate: true,
        registrationDate: true,
        doors: true,
        seats: true,
        engineModel: true,
        enginePower: true,
        batteryCapacity: true,
        rangeKm: true,
        emissionStandard: true,
        dimensions: true,
        curbWeightKg: true,
        descriptionZh: true,
        descriptionEn: true,
        descriptionRu: true,
        highlights: true,
        specifications: true,
        media: { include: { media: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!vehicle) throw new NotFoundException('车辆不存在');
    return vehicle;
  }
}
