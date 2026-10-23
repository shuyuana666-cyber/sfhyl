import {
  BannerStatus,
  ContentStatus,
  Currency,
  Prisma,
  PrismaClient,
  StorageDriver,
  VehicleMediaType,
  VehicleSaleStatus,
  VehicleType,
} from '@prisma/client';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

interface LegacyMedia { image: string; title?: string; active?: boolean }
interface LegacyVehicle {
  id: string; brand: string; title: string; image: string; price: number; rub?: string; year: number; mileage: number;
  description?: string; engine?: string; transmission?: string; fuel?: string; bodyType?: string; drive?: string;
  color?: string; volume?: string; power?: string; vin?: string; location?: string; gallery?: string[];
}
interface LegacyContent {
  home: { heroSlides?: LegacyMedia[]; featuredVideo?: { src?: string; poster?: string; title?: string; badge?: string }; vehicles?: LegacyVehicle[] };
  about?: { paragraphs?: string[]; aboutVideo?: { src?: string; poster?: string; title?: string }; footerAddresses?: string[] };
}

const prisma = new PrismaClient();

function firstExisting(paths: string[]): string {
  const found = paths.find(existsSync);
  if (!found) throw new Error(`Legacy content file not found. Checked: ${paths.join(', ')}`);
  return found;
}

const inputPath = process.env.LEGACY_CONTENT_PATH
  ? resolve(process.env.LEGACY_CONTENT_PATH)
  : firstExisting([
      resolve(process.cwd(), 'data/site-content.json'),
      resolve(process.cwd(), '../../data/site-content.json'),
    ]);
const projectRoot = existsSync(resolve(process.cwd(), 'public')) ? process.cwd() : resolve(process.cwd(), '../..');

function slug(value: string): string {
  const normalized = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized || `legacy-${Buffer.from(value).toString('hex').slice(0, 20)}`;
}

function mimeType(url: string): string {
  const extension = extname(url).toLowerCase();
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm' } as Record<string, string>)[extension] || 'application/octet-stream';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

async function media(url: string, title = ''): Promise<bigint | null> {
  if (!url) return null;
  const objectKey = `legacy${url.startsWith('/') ? url : `/${url}`}`;
  const existing = await prisma.mediaAsset.findFirst({ where: { driver: StorageDriver.LOCAL, objectKey } });
  const localPath = resolve(projectRoot, 'public', url.replace(/^\//, ''));
  const extension = extname(url).replace('.', '').toLowerCase() || null;
  const data = {
    driver: StorageDriver.LOCAL,
    bucket: null,
    objectKey,
    url,
    originalName: title || url.split('/').pop(),
    filename: url.split('/').pop() || objectKey.replace(/\//g, '-'),
    extension,
    mimeType: mimeType(url),
    sizeBytes: BigInt(existsSync(localPath) ? statSync(localPath).size : 0),
    altEn: title || undefined,
    deletedAt: null,
  } satisfies Prisma.MediaAssetUncheckedCreateInput;
  if (existing) {
    await prisma.mediaAsset.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  return (await prisma.mediaAsset.create({ data })).id;
}

async function importBanners(slides: LegacyMedia[]): Promise<number> {
  for (const [index, slide] of slides.entries()) {
    const desktopMediaId = await media(slide.image, slide.title);
    await prisma.banner.upsert({
      where: { key: `legacy-home-${index + 1}` },
      update: { titleEn: slide.title, desktopMediaId, status: BannerStatus.ACTIVE, sortOrder: index * 10, deletedAt: null },
      create: { key: `legacy-home-${index + 1}`, titleEn: slide.title, desktopMediaId, status: BannerStatus.ACTIVE, sortOrder: index * 10 },
    });
  }
  return slides.length;
}

async function importVehicle(vehicle: LegacyVehicle, index: number): Promise<void> {
  const brandSlug = slug(vehicle.brand);
  const brand = await prisma.brand.upsert({
    where: { slug: brandSlug },
    update: { nameEn: vehicle.brand, isEnabled: true, deletedAt: null },
    create: { slug: brandSlug, nameZh: vehicle.brand, nameEn: vehicle.brand, sortOrder: index * 10 },
  });
  const coverMediaId = await media(vehicle.image, vehicle.title);
  const galleryUrls = [...new Set([vehicle.image, ...(vehicle.gallery || [])].filter(Boolean))];
  const record = await prisma.vehicle.upsert({
    where: { legacyId: vehicle.id },
    update: {
      stockNo: vehicle.id, slug: slug(vehicle.id), brandId: brand.id, nameEn: vehicle.title, nameRu: vehicle.title,
      year: vehicle.year, price: new Prisma.Decimal(vehicle.price), priceNote: vehicle.rub, mileage: vehicle.mileage,
      currency: Currency.CNY,
      coverMediaId, status: ContentStatus.PUBLISHED, saleStatus: VehicleSaleStatus.AVAILABLE, publishedAt: new Date(), deletedAt: null,
      engineModel: vehicle.engine, transmission: vehicle.transmission, fuelType: vehicle.fuel, bodyType: vehicle.bodyType,
      driveType: vehicle.drive, exteriorColor: vehicle.color, enginePower: vehicle.power, vin: vehicle.vin || null,
      location: vehicle.location, shortDescriptionEn: vehicle.description, shortDescriptionRu: vehicle.description,
    },
    create: {
      legacyId: vehicle.id, stockNo: vehicle.id, slug: slug(vehicle.id), brandId: brand.id, type: VehicleType.USED,
      nameZh: `${vehicle.brand} ${vehicle.id}`, nameEn: vehicle.title, nameRu: vehicle.title, year: vehicle.year,
      price: new Prisma.Decimal(vehicle.price), currency: Currency.CNY, showPrice: true, showInquiryPrice: true,
      priceNote: vehicle.rub, mileage: vehicle.mileage, coverMediaId, status: ContentStatus.PUBLISHED,
      saleStatus: VehicleSaleStatus.AVAILABLE, publishedAt: new Date(), sortOrder: index * 10,
      engineModel: vehicle.engine, transmission: vehicle.transmission, fuelType: vehicle.fuel, bodyType: vehicle.bodyType,
      driveType: vehicle.drive, exteriorColor: vehicle.color, enginePower: vehicle.power, vin: vehicle.vin || null,
      location: vehicle.location, shortDescriptionEn: vehicle.description, shortDescriptionRu: vehicle.description,
    },
  });
  await prisma.vehicleMedia.deleteMany({ where: { vehicleId: record.id } });
  for (const [mediaIndex, url] of galleryUrls.entries()) {
    const mediaId = await media(url, vehicle.title);
    if (!mediaId) continue;
    await prisma.vehicleMedia.create({ data: {
      vehicleId: record.id, mediaId, type: mediaIndex === 0 ? VehicleMediaType.COVER : VehicleMediaType.GALLERY,
      isCover: mediaIndex === 0, sortOrder: mediaIndex, altEn: vehicle.title, altRu: vehicle.title,
    } });
  }
}

async function importAbout(content: LegacyContent): Promise<void> {
  const paragraphs = content.about?.paragraphs || [];
  const addresses = content.about?.footerAddresses || [];
  const html = [...paragraphs.map((item) => `<p>${escapeHtml(item)}</p>`), addresses.length ? `<h2>Адреса</h2><ul>${addresses.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''].join('');
  await prisma.page.upsert({
    where: { slug: 'about' },
    update: { titleRu: 'О нас', content: { zh: '', en: '', ru: html }, status: ContentStatus.PUBLISHED, publishedAt: new Date(), deletedAt: null },
    create: { slug: 'about', titleZh: '关于我们', titleEn: 'About us', titleRu: 'О нас', content: { zh: '', en: '', ru: html }, status: ContentStatus.PUBLISHED, publishedAt: new Date() },
  });
  const video = content.home.featuredVideo || content.about?.aboutVideo;
  if (video) {
    const backgroundMediaId = await media(video.poster || '', video.title);
    await prisma.homepageSection.update({
      where: { key: 'video' },
      data: { titleEn: video.title, titleRu: video.title, subtitleEn: 'badge' in video && typeof video.badge === 'string' ? video.badge : undefined, backgroundMediaId, config: { videoUrl: video.src || '' }, isEnabled: true },
    });
  }
}

async function importLegacy(): Promise<void> {
  const content = JSON.parse(readFileSync(inputPath, 'utf8')) as LegacyContent;
  const bannerCount = await importBanners(content.home.heroSlides || []);
  const vehicles = content.home.vehicles || [];
  for (const [index, vehicle] of vehicles.entries()) await importVehicle(vehicle, index + 1);
  await importAbout(content);
  console.log(`Legacy import completed: ${bannerCount} banners, ${vehicles.length} vehicles.`);
}

async function main(): Promise<void> {
  try {
    await importLegacy();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
