import { serviceModuleBodies } from "./homepage-service-content";

export type LocalizedText = { zh: string; en: string; ru: string };

export type HomepageDefaultAssetKey =
  | "hero01"
  | "hero02"
  | "hero03"
  | "hero04"
  | "aboutVideo"
  | "transport01"
  | "transport02"
  | "transport03"
  | "transport04"
  | "transport05"
  | "staff01"
  | "staff02"
  | "staff03"
  | "staff04"
  | "staff05"
  | "video01"
  | "video02"
  | "video03"
  | "videoPoster01"
  | "videoPoster02"
  | "videoPoster03";

export interface HomepageDefaultAsset {
  key: HomepageDefaultAssetKey;
  filename: string;
  mimeType: string;
}

export const homepageDefaultAssets: HomepageDefaultAsset[] = [
  { key: "hero01", filename: "hero-01.webp", mimeType: "image/webp" },
  { key: "hero02", filename: "hero-02.webp", mimeType: "image/webp" },
  { key: "hero03", filename: "hero-03.webp", mimeType: "image/webp" },
  { key: "hero04", filename: "hero-04.webp", mimeType: "image/webp" },
  { key: "aboutVideo", filename: "about-video.mp4", mimeType: "video/mp4" },
  { key: "transport01", filename: "transport-01.webp", mimeType: "image/webp" },
  { key: "transport02", filename: "transport-02.webp", mimeType: "image/webp" },
  { key: "transport03", filename: "transport-03.webp", mimeType: "image/webp" },
  { key: "transport04", filename: "transport-04.webp", mimeType: "image/webp" },
  { key: "transport05", filename: "transport-05.webp", mimeType: "image/webp" },
  { key: "staff01", filename: "staff-01.webp", mimeType: "image/webp" },
  { key: "staff02", filename: "staff-02.webp", mimeType: "image/webp" },
  { key: "staff03", filename: "staff-03.webp", mimeType: "image/webp" },
  { key: "staff04", filename: "staff-04.webp", mimeType: "image/webp" },
  { key: "staff05", filename: "staff-05.webp", mimeType: "image/webp" },
  { key: "video01", filename: "video-01.mp4", mimeType: "video/mp4" },
  { key: "video02", filename: "video-02.mp4", mimeType: "video/mp4" },
  { key: "video03", filename: "video-03.mp4", mimeType: "video/mp4" },
  { key: "videoPoster01", filename: "video-01.webp", mimeType: "image/webp" },
  { key: "videoPoster02", filename: "video-02.webp", mimeType: "image/webp" },
  { key: "videoPoster03", filename: "video-03.webp", mimeType: "image/webp" },
];

export type HomepageDefaultAssetIds = Record<HomepageDefaultAssetKey, string>;

const localized = (zh: string, en: string, ru: string): LocalizedText => ({
  zh,
  en,
  ru,
});

const toHtml = (paragraphs: string[]): string =>
  paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");

const emptyText = (): LocalizedText => localized("", "", "");

export function buildManagedHomepageContent(
  media: HomepageDefaultAssetIds,
): Record<string, unknown> {
  return {
    managed: true,
    schemaVersion: 5,
    companyOverviewSeeded: false,
    companyOverviewLayoutVersion: 0,
    companyOverviewBodyFormatVersion: 0,
    hero: [
      {
        imageMediaId: media.hero03,
        mobileMediaId: media.hero03,
        title: localized(
          "SFHYL.CN 物流与停车场",
          "SFHYL.CN parking and logistics yard",
          "Стоянка и логистический двор SFHYL.CN",
        ),
        enabled: true,
      },
      {
        imageMediaId: media.hero01,
        mobileMediaId: media.hero01,
        title: localized(
          "SFHYL.CN 夏季停车场",
          "SFHYL.CN summer parking yard",
          "Летняя стоянка SFHYL.CN",
        ),
        enabled: true,
      },
      {
        imageMediaId: media.hero02,
        mobileMediaId: media.hero02,
        title: localized(
          "SFHYL.CN 车辆停车场",
          "SFHYL.CN vehicle yard",
          "Автомобильная стоянка SFHYL.CN",
        ),
        enabled: true,
      },
      {
        imageMediaId: media.hero04,
        mobileMediaId: media.hero04,
        title: localized("SFHYL.CN", "SFHYL.CN", "SFHYL.CN"),
        enabled: true,
      },
    ],
    about: {
      title: localized("关于我们", "About us", "О нас"),
      body: {
        zh: toHtml([
          "绥芬河友邻经贸有限公司专注于中国汽车整车出口、汽车配件跨境贸易及国内汽车购销服务。",
          "公司依托绥芬河口岸区位优势，构建覆盖俄罗斯及中亚五国的汽车贸易与出口网络。",
          "我们拥有稳定的整车与配件供应资源，可为客户提供采购、报关、出口及跨境交付服务。",
          "核心团队深耕汽车与出行行业多年，具备车辆运营管理和国际贸易经验。",
          "SFHYL.CN 持续为合作伙伴提供高效、可靠的汽车贸易解决方案。",
        ]),
        en: toHtml([
          "Suifenhe Youlin Economic & Trade Co., Ltd. specializes in Chinese vehicle exports, automotive-parts trade, and domestic vehicle sales.",
          "Based at the Suifenhe land port, the company serves an export network across Russia and five Central Asian countries.",
          "Stable vehicle and parts supply supports procurement, customs declaration, export, and cross-border delivery.",
          "The core team brings practical experience in vehicle operations and international trade.",
          "SFHYL.CN provides efficient, reliable automotive-trade solutions for long-term partners.",
        ]),
        ru: toHtml([
          "Suifenhe Youlin Economic & Trade Co., Ltd. специализируется на экспорте китайских автомобилей, торговле автозапчастями и внутренней продаже автомобилей.",
          "Компания использует преимущества сухопутного порта Суйфэньхэ и работает с Россией и странами Центральной Азии.",
          "Стабильные поставки автомобилей и запчастей позволяют организовать закупку, таможенное оформление, экспорт и доставку.",
          "Основная команда обладает практическим опытом в управлении автопарком и международной торговле.",
          "SFHYL.CN предлагает эффективные и надёжные решения для долгосрочных партнёров.",
        ]),
      },
      button: {
        label: localized("了解更多", "Learn more", "Подробнее"),
        href: "#footer",
      },
      videoMediaId: media.aboutVideo,
      posterMediaId: media.hero02,
    },
    transport: {
      title: localized(
        "运输与交付",
        "Transportation and delivery",
        "Перевозка и доставка",
      ),
      items: ([
        ["transport01", "运输交付 1", "Transport 1", "Транспортировка 1"],
        ["transport02", "运输交付 2", "Transport 2", "Транспортировка 2"],
        ["transport03", "运输交付 3", "Transport 3", "Транспортировка 3"],
        ["transport04", "运输交付 4", "Transport 4", "Транспортировка 4"],
        ["transport05", "运输交付 5", "Transport 5", "Транспортировка 5"],
      ] as const).map(([key, zh, en, ru]) => ({
        imageMediaId: media[key as HomepageDefaultAssetKey],
        title: localized(zh, en, ru),
        description: emptyText(),
      })),
    },
    staff: {
      title: localized("员工风采", "Our team", "Наша команда"),
      items: ([
        ["staff01", "丽莎", "Lisa", "Лиза"],
        ["staff02", "阿廖娜", "Alena", "Алёна"],
        ["staff03", "亚历山大", "Alexander", "Александр"],
        ["staff04", "索尼娅", "Sonya", "Соня"],
        ["staff05", "沃洛佳", "Volodya", "Володя"],
      ] as const).map(([key, zh, en, ru]) => ({
        imageMediaId: media[key as HomepageDefaultAssetKey],
        name: localized(zh, en, ru),
        role: emptyText(),
        description: emptyText(),
      })),
    },
    videos: {
      title: localized("视频", "Video", "Видео"),
      items: ([
        ["video01", "videoPoster01", "视频 1", "Video 1", "Видео 1"],
        ["video02", "videoPoster02", "视频 2", "Video 2", "Видео 2"],
        ["video03", "videoPoster03", "视频 3", "Video 3", "Видео 3"],
      ] as const).map(([videoKey, posterKey, zh, en, ru]) => ({
        videoMediaId: media[videoKey as HomepageDefaultAssetKey],
        posterMediaId: media[posterKey as HomepageDefaultAssetKey],
        title: localized(zh, en, ru),
      })),
    },
    quickNav: {
      title: localized("快捷导航", "Quick navigation", "Быстрая навигация"),
      items: ([
        ["#about", "关于我们", "About us", "О нас"],
        ["#fahuo", "运输与交付", "Transportation and delivery", "Перевозка и доставка"],
        ["#yuangong", "员工风采", "Our team", "Наша команда"],
        ["#shipin", "视频", "Video", "Видео"],
      ] as const).map(([href, zh, en, ru]) => ({
        href,
        label: localized(zh, en, ru),
        enabled: true,
      })),
    },
    locations: {
      title: localized(
        "办公室与停车场",
        "Our offices and parking yards",
        "Наши офисы и стоянки",
      ),
      items: ([
        ["OFFICE", "沈阳总部", "Shenyang headquarters", "Главный офис в Шэньяне", "沈阳总部地址：沈阳市浑南三路 1-8 号同方大厦 704 室", "Shenyang headquarters: Room 704, Tongfang Building, No. 1-8 Hunnan 3rd Road, Shenyang", "Адрес главного офиса в Шэньяне Комната 704, здание Тунфан, дом 1-8, улица Хуннаньсань, город Шэньян"],
        ["OFFICE", "沈阳开发部", "Shenyang development office", "Офис отдела разработки в Шэньяне", "沈阳开发部地址：沈阳市沈北新区创客社区 C 座 238 室", "Shenyang development office: Room 238, Block C, Chuangke Community, Shenbei New District, Shenyang", "Адрес офиса отдела разработки в Шэньяне Комната 238, блок C, сообщество Чуанкэ, новый район Шэнбэй, город Шэньян"],
        ["OFFICE", "绥芬河办公室", "Suifenhe office", "Офис в Суйфэньхэ", "绥芬河办公室地址：黑龙江省牡丹江市绥芬河市黄河路 26 号", "Suifenhe office: No. 26 Huanghe Road, Suifenhe, Mudanjiang, Heilongjiang", "Адрес офиса в Суйфэньхэ Дом 26, улица Хуанхэ, город Суйфэньхэ, город Муданьцзян, провинция Хэйлунцзян"],
        ["PARKING", "绥芬河 1 号停车场", "Suifenhe parking yard No. 1", "Стоянка №1 в Суйфэньхэ", "绥芬河 1 号停车场：绥芬河国际客运站东北约 240 米，乌苏里街安图 1 号库", "Suifenhe parking yard No. 1: about 240 m northeast of the international bus station, Wusuli Street, Antu Garage No. 1", "Адрес парковки №1 в Суйфэньхэ Примерно в 240 метрах к северо-востоку от международного автовокзала, улица Уссури, город Суйфэньхэ, город Муданьцзян, провинция Хэйлунцзян, гараж Анту №1"],
        ["PARKING", "绥芬河 2 号停车场", "Suifenhe parking yard No. 2", "Стоянка №2 в Суйфэньхэ", "绥芬河 2 号停车场：黑龙江省牡丹江市绥芬河市黄河路 26 号", "Suifenhe parking yard No. 2: No. 26 Huanghe Road, Suifenhe, Mudanjiang, Heilongjiang", "Адрес парковки №2 в Суйфэньхэ Дом 26, улица Хуанхэ, город Суйфэньхэ, город Муданьцзян, провинция Хэйлунцзян"],
        ["OFFICE", "哈尔滨办公室", "Harbin office", "Офис в Харбине", "哈尔滨办公室地址：黑龙江省哈尔滨市南岗区华润置地 4 号楼 1314 室", "Harbin office: Room 1314, Building 4, China Resources Land complex, Nangang District, Harbin", "Адрес офиса в Харбине Комната 1314, корпус 4, комплекс Хуарун Чжиди, район Наньган, город Харбин, провинция Хэйлунцзян"],
        ["PARKING", "哈尔滨停车场", "Harbin parking yard", "Стоянка в Харбине", "哈尔滨停车场地址：哈尔滨市道里区新发镇机场路 650 号", "Harbin parking yard: No. 650 Airport Road, Xinfa Town, Daoli District, Harbin", "Адрес парковки в Харбине Дом 650, улица аэропорта Цзянлу, поселок Синьфа, район Даоли, город Харбин"],
      ] as const).map(([type, nameZh, nameEn, nameRu, addressZh, addressEn, addressRu]) => ({
        type,
        name: localized(nameZh, nameEn, nameRu),
        address: localized(addressZh, addressEn, addressRu),
        mapUrl: "",
        enabled: true,
      })),
    },
    customModules: [
      {
        id: "home-service-process",
        enabled: true,
        placement: "HOME_AFTER_FEATURES",
        displayScope: "HOME",
        title: localized("服务流程", "How the service works", "Как проходит работа"),
        body: serviceModuleBodies["home-service-process"],
        mediaType: "NONE",
        imageMediaId: null,
        videoMediaId: null,
        posterMediaId: null,
        button: { label: emptyText(), href: "" },
      },
      {
        id: "home-service-regions",
        enabled: true,
        placement: "HOME_AFTER_FEATURES",
        displayScope: "HOME",
        title: localized("服务区域", "Service regions", "География обслуживания"),
        body: serviceModuleBodies["home-service-regions"],
        mediaType: "NONE",
        imageMediaId: null,
        videoMediaId: null,
        posterMediaId: null,
        button: { label: emptyText(), href: "" },
      },
    ],
  };
}

export function isManagedHomepageContent(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).managed === true,
  );
}
