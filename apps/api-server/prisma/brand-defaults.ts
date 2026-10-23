import { PrismaClient, StorageDriver } from "@prisma/client";

// The order mirrors the default homepage catalogue. Admin changes to names,
// visibility, icons and ordering remain authoritative after first import.
const defaultBrands = [
  ["lada", "拉达（VAZ）", "LADA", "Лада", "lada-logo.svg"],
  ["ford", "福特", "FORD", "Форд", "ford-logo.png"],
  ["hyundai", "现代", "HYUNDAI", "Хёндэ", "hyundai-logo.svg"],
  ["skoda", "斯柯达", "SKODA", "Шкода", "skoda-logo.svg"],
  ["audi", "奥迪", "AUDI", "Ауди", "audi-logo.svg"],
  ["geely", "吉利", "GEELY", "Джили", "geely-logo.svg"],
  ["kia", "起亚", "KIA", "Киа", "kia-logo.svg"],
  ["tank", "坦克", "TANK", "Танк", "tank-logo.svg"],
  ["bmw", "宝马", "BMW", "БМВ", "bmw-logo.svg"],
  ["haval", "哈弗", "HAVAL", "Хавейл", "haval-logo.png"],
  ["mercedes-benz", "梅赛德斯-奔驰", "MERCEDES-BENZ", "Мерседес-Бенц", "mercedes-benz-logo.svg"],
  ["toyota", "丰田", "TOYOTA", "Тойота", "toyota-logo.svg"],
  ["chevrolet", "雪佛兰", "CHEVROLET", "Шевроле", "chevrolet-logo.png"],
  ["honda", "本田", "HONDA", "Хонда", "honda-logo.png"],
  ["nissan", "日产", "NISSAN", "Ниссан", "nissan-logo.svg"],
  ["volkswagen", "大众汽车", "VOLKSWAGEN", "Фольксваген", "volkswagen-logo.svg"],
  ["mazda", "马自达", "MAZDA", "Мазда", "mazda-logo.svg"],
  ["jetour", "捷途", "JETOUR", "Джетур", "jetour-logo.svg"],
] as const;

const legacySortOrders: Record<string, number> = {
  haval: 10,
  toyota: 20,
  mazda: 30,
  bmw: 40,
  audi: 50,
  jetour: 60,
  volkswagen: 70,
};

export async function seedBrands(prisma: PrismaClient): Promise<void> {
  for (const [index, [slug, nameZh, nameEn, nameRu, filename]] of defaultBrands.entries()) {
    const objectKey = `default-brand-icons/${filename}`;
    const existingMedia = await prisma.mediaAsset.findUnique({
      where: { driver_bucket_objectKey: { driver: StorageDriver.LOCAL, bucket: "website", objectKey } },
    });
    const media = existingMedia ?? await prisma.mediaAsset.create({
      data: {
        driver: StorageDriver.LOCAL,
        bucket: "website",
        objectKey,
        url: `/brand-icons/${filename}`,
        filename,
        originalName: filename,
        extension: filename.split(".").pop(),
        mimeType: filename.endsWith(".svg") ? "image/svg+xml" : "image/png",
        sizeBytes: 0n,
        altZh: `${nameZh}品牌标志`,
        altEn: `${nameEn} logo`,
        altRu: `${nameRu} логотип`,
      },
    });
    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      if (existing.deletedAt) continue;
      const update: { nameZh?: string; nameRu?: string; sortOrder?: number; logoMediaId?: bigint } = {};
      if (existing.nameZh === nameEn) update.nameZh = nameZh;
      if (existing.nameRu === null) update.nameRu = nameRu;
      if (existing.sortOrder === legacySortOrders[slug]) update.sortOrder = (index + 1) * 10;
      // A default asset is created only once. If an editor later clears the icon,
      // another seed run must leave the empty selection intact.
      if (!existingMedia && !existing.logoMediaId) update.logoMediaId = media.id;
      if (Object.keys(update).length) await prisma.brand.update({ where: { id: existing.id }, data: update });
      continue;
    }
    await prisma.brand.create({
      data: {
        slug,
        nameZh,
        nameEn,
        nameRu,
        logoMediaId: media.id,
        sortOrder: (index + 1) * 10,
      },
    });
  }

}
