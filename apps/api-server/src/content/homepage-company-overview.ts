type JsonObject = Record<string, unknown>;

export const COMPANY_OVERVIEW_MODULE_ID = "company-overview";
export const COMPANY_CORE_BUSINESS_MODULE_ID = "company-core-business";
export const COMPANY_VEHICLE_EXPORTS_MODULE_ID = "company-vehicle-exports";
export const COMPANY_PARTS_EXPORTS_MODULE_ID = "company-parts-exports";
export const COMPANY_CORE_STRENGTHS_MODULE_ID = "company-core-strengths";
export const COMPANY_OVERVIEW_LAYOUT_VERSION = 2;
export const COMPANY_OVERVIEW_BODY_FORMAT_VERSION = 1;

const companyModuleIds = new Set([
  COMPANY_OVERVIEW_MODULE_ID,
  COMPANY_CORE_BUSINESS_MODULE_ID,
  COMPANY_VEHICLE_EXPORTS_MODULE_ID,
  COMPANY_PARTS_EXPORTS_MODULE_ID,
  COMPANY_CORE_STRENGTHS_MODULE_ID,
]);

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function localized(zh: string, en: string, ru: string): JsonObject {
  return { zh, en, ru };
}

function moduleId(value: unknown): string {
  const id = object(value).id;
  return typeof id === "string" ? id : "";
}

function mediaType(value: unknown): "NONE" | "IMAGE" | "VIDEO" {
  return value === "IMAGE" || value === "VIDEO" ? value : "NONE";
}

function mediaId(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function companyModule(
  id: string,
  title: JsonObject,
  body: JsonObject,
): JsonObject {
  return {
    id,
    enabled: true,
    placement: "ABOUT_AFTER_INTRO",
    displayScope: "ABOUT",
    title,
    body,
    mediaType: "NONE",
    imageMediaId: null,
    videoMediaId: null,
    posterMediaId: null,
    button: {
      label: localized("", "", ""),
      href: "",
    },
  };
}

export function companyOverviewModules(): JsonObject[] {
  return [
    companyModule(
      COMPANY_OVERVIEW_MODULE_ID,
      localized(
        "车辆运营管理经验",
        "Fleet operations experience",
        "Опыт управления автопарком",
      ),
      localized(
        "<p>公司总经理张显东旗下的深圳市通利华出行科技有限公司管理运营车辆超过 3500 台，并为滴滴 KA 合作伙伴。</p>",
        "<p>Shenzhen Tonglihua Mobility Technology Co., Ltd., under General Manager Zhang Xiandong, manages more than 3,500 vehicles and is a Didi KA partner.</p>",
        "<p>Компания Shenzhen Tonglihua Mobility Technology Co., Ltd. под руководством генерального менеджера Чжан Сяньдуна управляет парком более чем из 3500 автомобилей и является партнёром Didi KA.</p>",
      ),
    ),
    companyModule(
      COMPANY_CORE_BUSINESS_MODULE_ID,
      localized("主营业务", "Core Business", "Основные направления"),
      localized(
        "<p><strong>二手车出口：</strong>中、日、德、韩、美多品牌二手车，经绥芬河口岸报关出口至俄罗斯及中亚。</p><p><strong>汽车配件出口：</strong>拆车件及新品配件，线上平台引流与私域转化协同开展。</p><p><strong>汽车内贸：</strong>国内汽车购销。</p>",
        "<p><strong>Pre-owned vehicle exports:</strong> Multi-brand used vehicles from China, Japan, Germany, South Korea, and the United States, customs-cleared at the Suifenhe port for export to Russia and Central Asia.</p><p><strong>Automotive parts exports:</strong> Dismantled and new parts, supported by online-platform lead generation and private-channel conversion.</p><p><strong>Domestic vehicle trade:</strong> Vehicle purchasing and sales within China.</p>",
        "<p><strong>Экспорт автомобилей с пробегом:</strong> подержанные автомобили различных марок из Китая, Японии, Германии, Южной Кореи и США, оформляемые на экспорт через порт Суйфэньхэ в Россию и Центральную Азию.</p><p><strong>Экспорт автозапчастей:</strong> контрактные и новые запчасти с привлечением клиентов через онлайн-платформы и дальнейшей работой по частным каналам.</p><p><strong>Внутренняя торговля автомобилями:</strong> закупка и продажа автомобилей в Китае.</p>",
      ),
    ),
    companyModule(
      COMPANY_VEHICLE_EXPORTS_MODULE_ID,
      localized("整车出口", "Complete Vehicle Exports", "Экспорт автомобилей"),
      localized(
        "<p><strong>产品矩阵</strong></p><p>丰田卡罗拉（2025 款 1.2T 先锋版，860 台大货储备，EXW 天津）。</p><p>马自达 CX-5 / CX-50（绥芬河现货，多配置可选）。</p><p>红旗 HS5 2022 款（厂家直出，欧盟 + OTTC 双认证）。</p><p>马自达系列及其他适配俄罗斯市场的日系、德系车型。</p>",
        "<p><strong>Product Portfolio</strong></p><p>2025 Toyota Corolla 1.2T Pioneer Edition, with an 860-unit inventory allocation, EXW Tianjin.</p><p>Mazda CX-5 / CX-50, available from stock in Suifenhe with multiple configurations.</p><p>2022 Hongqi HS5, supplied directly by the manufacturer with dual EU + OTTC certification.</p><p>Mazda models and other Japanese and German vehicles suited to the Russian market.</p>",
        "<p><strong>Продуктовый портфель</strong></p><p>Toyota Corolla 2025 года, версия 1.2T Pioneer Edition: резерв 860 автомобилей, EXW Тяньцзинь.</p><p>Mazda CX-5 / CX-50: автомобили в наличии в Суйфэньхэ, доступны различные комплектации.</p><p>Hongqi HS5 2022 года: прямые поставки от производителя, двойная сертификация ЕС + OTTC.</p><p>Модели Mazda и другие японские и немецкие автомобили, подходящие для российского рынка.</p>",
      ),
    ),
    companyModule(
      COMPANY_PARTS_EXPORTS_MODULE_ID,
      localized("配件出口", "Parts Exports", "Экспорт автозапчастей"),
      localized(
        "<p>奇瑞全系拆车件。</p><p>其他适配俄系及中亚市场的拆车配件。</p>",
        "<p>Dismantled parts for the full Chery range.</p><p>Other dismantled automotive parts suited to Russian and Central Asian markets.</p>",
        "<p>Контрактные запчасти для всего модельного ряда Chery.</p><p>Другие контрактные автозапчасти, подходящие для российского и центральноазиатского рынков.</p>",
      ),
    ),
    companyModule(
      COMPANY_CORE_STRENGTHS_MODULE_ID,
      localized("核心优势", "Core Strengths", "Ключевые преимущества"),
      localized(
        "<p><strong>26 年行业背书：</strong>张显东团队 26 年汽车行业经验，累计管理运营 3500+ 台车辆。</p><p><strong>口岸优势：</strong>以绥芬河口岸为基地，对接俄罗斯及中亚五国。</p><p><strong>海量车源：</strong>860 台丰田卡罗拉大货储备，以及红旗 HS5 厂家直源。</p><p><strong>渠道双线并行：</strong>线上覆盖 Wildberries、Ozon、AliExpress、Kaspi、Yandex 五大电商平台，线下布局经销商体系。</p><p><strong>中俄双主体运营：</strong>中国方绥芬河友邻经贸负责采购与报关，俄方俄罗斯友邻汽车集团负责境外仓储与销售。</p>",
        "<p><strong>26 years of industry experience:</strong> Zhang Xiandong's team brings 26 years of automotive expertise and experience managing more than 3,500 vehicles.</p><p><strong>Port advantage:</strong> Based at the Suifenhe port, with direct links to Russia and five Central Asian countries.</p><p><strong>Substantial vehicle supply:</strong> An 860-unit Toyota Corolla allocation and manufacturer-direct Hongqi HS5 resources.</p><p><strong>Dual-channel reach:</strong> Online coverage across Wildberries, Ozon, AliExpress, Kaspi, and Yandex, complemented by an offline dealer network.</p><p><strong>China-Russia dual-entity operations:</strong> Suifenhe Youlin Economic &amp; Trade handles purchasing and customs declaration in China, while Russian Youlin Automobile Group manages overseas warehousing and sales.</p>",
        "<p><strong>26 лет отраслевого опыта:</strong> команда Чжан Сяньдуна обладает 26-летним опытом в автомобильной отрасли и опытом управления более чем 3500 автомобилями.</p><p><strong>Преимущество порта:</strong> база в Суйфэньхэ с прямым выходом на Россию и пять стран Центральной Азии.</p><p><strong>Значительный объём автомобилей:</strong> резерв 860 Toyota Corolla и прямой доступ к ресурсам производителя Hongqi HS5.</p><p><strong>Двухканальная система продаж:</strong> присутствие на Wildberries, Ozon, AliExpress, Kaspi и Yandex, дополненное офлайн-сетью дилеров.</p><p><strong>Два операционных субъекта в Китае и России:</strong> Suifenhe Youlin Economic &amp; Trade отвечает за закупки и таможенное оформление в Китае, а российская автомобильная группа Youlin — за зарубежное хранение и продажи.</p>",
      ),
    ),
  ];
}

export function companyOverviewModule(): JsonObject {
  return companyOverviewModules()[0] ?? {};
}

function isCompanyOverviewLayoutSeeded(value: unknown): boolean {
  return Number(object(value).companyOverviewLayoutVersion) >= COMPANY_OVERVIEW_LAYOUT_VERSION;
}

export function isCompanyOverviewSeeded(value: unknown): boolean {
  const source = object(value);
  return isCompanyOverviewLayoutSeeded(source)
    && Number(source.companyOverviewBodyFormatVersion) >= COMPANY_OVERVIEW_BODY_FORMAT_VERSION;
}

function preserveLegacyPresentation(
  module: JsonObject,
  legacy: unknown,
): JsonObject {
  const source = object(legacy);
  const type = mediaType(source.mediaType);
  const defaultButton = object(module.button);
  const legacyButton = object(source.button);
  return {
    ...module,
    enabled: source.enabled !== false,
    mediaType: type,
    imageMediaId: type === "IMAGE" ? mediaId(source.imageMediaId) : null,
    videoMediaId: type === "VIDEO" ? mediaId(source.videoMediaId) : null,
    posterMediaId: type === "VIDEO" ? mediaId(source.posterMediaId) : null,
    button: {
      ...defaultButton,
      label: object(legacyButton.label),
      href: typeof legacyButton.href === "string" ? legacyButton.href : "",
    },
  };
}

function paragraphizeListMarkup(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(/<(?:ul|ol)\b[^>]*>/gi, "")
    .replace(/<\/(?:ul|ol)>/gi, "")
    .replace(/<li\b[^>]*>/gi, "<p>")
    .replace(/<\/li>/gi, "</p>");
}

function paragraphizeCompanyModuleBody(value: unknown): JsonObject {
  const source = object(value);
  return {
    zh: paragraphizeListMarkup(source.zh),
    en: paragraphizeListMarkup(source.en),
    ru: paragraphizeListMarkup(source.ru),
  };
}

function seedCompanyOverviewLayout(source: JsonObject): JsonObject {
  const modules = array(source.customModules);
  if (isCompanyOverviewLayoutSeeded(source)) {
    return source;
  }

  const legacyIndex = modules.findIndex(
    (item) => moduleId(item) === COMPANY_OVERVIEW_MODULE_ID,
  );
  const legacyModule = legacyIndex >= 0 ? modules[legacyIndex] : undefined;
  const shouldSeedDefaults = source.companyOverviewSeeded !== true;
  const shouldMigrateLegacyModule = legacyIndex >= 0;
  const nextBase = shouldMigrateLegacyModule
    ? [...modules.slice(0, legacyIndex), ...modules.slice(legacyIndex + 1)]
    : [...modules];

  const existingIds = new Set(nextBase.map(moduleId));
  const additions = companyOverviewModules()
    .map((module) => {
      if (module.id !== COMPANY_OVERVIEW_MODULE_ID || !legacyModule) return module;
      return preserveLegacyPresentation(module, legacyModule);
    })
    .filter((module) => !existingIds.has(moduleId(module)));

  return {
    ...source,
    schemaVersion: 5,
    companyOverviewSeeded: true,
    companyOverviewLayoutVersion: COMPANY_OVERVIEW_LAYOUT_VERSION,
    customModules:
      shouldSeedDefaults || shouldMigrateLegacyModule
        ? shouldMigrateLegacyModule
          ? [...modules.slice(0, legacyIndex), ...additions, ...modules.slice(legacyIndex + 1)]
          : [...modules, ...additions]
        : modules,
  };
}

export function seedCompanyOverviewContent(value: unknown): JsonObject {
  const layout = seedCompanyOverviewLayout(object(value));
  if (Number(layout.companyOverviewBodyFormatVersion) >= COMPANY_OVERVIEW_BODY_FORMAT_VERSION) {
    return layout;
  }

  return {
    ...layout,
    schemaVersion: 5,
    companyOverviewBodyFormatVersion: COMPANY_OVERVIEW_BODY_FORMAT_VERSION,
    customModules: array(layout.customModules).map(
      (module) => {
        const source = object(module);
        return companyModuleIds.has(moduleId(source))
          ? { ...source, body: paragraphizeCompanyModuleBody(source.body) }
          : module;
      },
    ),
  };
}
