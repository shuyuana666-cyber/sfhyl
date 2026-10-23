type Language = "zh" | "en" | "ru";
type Localized = Record<Language, string>;
type ServiceModuleId = "home-service-process" | "home-service-regions";

const languages: Language[] = ["zh", "en", "ru"];
const localized = (zh: string, en: string, ru: string): Localized => ({ zh, en, ru });
const canonicalLegacyMarkup = (value: string): string => value.replace(/<br\s*\/?\s*>/gi, "<br>").replace(/>\s+</g, "><").trim();
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character] || character);

export const legacyServiceModuleBodies: Record<ServiceModuleId, Localized> = {
  "home-service-process": {
    zh: "<ol><li><strong>车辆采购</strong><br>按预算和需求筛选中国市场车型。</li><li><strong>车辆验检</strong><br>核对车况、配置与出口资料。</li><li><strong>跨境物流</strong><br>协调口岸、运输和交付流程。</li><li><strong>全程沟通</strong><br>在关键节点同步进度与车辆信息。</li></ol>",
    en: "<ol><li><strong>Vehicle sourcing</strong><br>Shortlist vehicles in China around your needs and budget.</li><li><strong>Inspection</strong><br>Check condition, specifications, and export documents.</li><li><strong>Cross-border logistics</strong><br>Coordinate port handling, transport, and delivery.</li><li><strong>Clear communication</strong><br>Get updates at each important handoff.</li></ol>",
    ru: "<ol><li><strong>Подбор автомобиля</strong><br>Подбираем автомобили в Китае с учётом ваших задач и бюджета.</li><li><strong>Проверка</strong><br>Проверяем состояние, комплектацию и экспортные документы.</li><li><strong>Международная логистика</strong><br>Координируем оформление, перевозку и доставку.</li><li><strong>Связь на каждом этапе</strong><br>Сообщаем статус на важных этапах поставки.</li></ol>",
  },
  "home-service-regions": {
    zh: "<p>业务覆盖俄罗斯及中亚五国：</p><ul><li>俄罗斯</li><li>哈萨克斯坦</li><li>吉尔吉斯斯坦</li><li>乌兹别克斯坦</li><li>塔吉克斯坦</li><li>土库曼斯坦</li></ul>",
    en: "<p>Our trade and export network covers Russia and the five Central Asian countries:</p><ul><li>Russia</li><li>Kazakhstan</li><li>Kyrgyzstan</li><li>Uzbekistan</li><li>Tajikistan</li><li>Turkmenistan</li></ul>",
    ru: "<p>Сеть торговли и экспорта охватывает Россию и пять стран Центральной Азии:</p><ul><li>Россия</li><li>Казахстан</li><li>Кыргызстан</li><li>Узбекистан</li><li>Таджикистан</li><li>Туркменистан</li></ul>",
  },
};

const processSteps: Array<{ title: Localized; summary: Localized; details: Localized[] }> = [
  {
    title: localized("需求确认", "Confirm your needs", "Уточнение задачи"),
    summary: localized("从目标市场、预算和车型偏好出发，把采购与交付要求梳理清楚。", "We start with your target market, budget, and vehicle preferences to clarify the purchase and delivery brief.", "Начинаем с рынка назначения, бюджета и предпочтений по автомобилю, чтобы уточнить условия покупки и передачи."),
    details: [
      localized("目标市场与车型偏好", "Target market and vehicle preferences", "Рынок назначения и предпочтения по моделям"),
      localized("预算、数量与配置", "Budget, quantity, and specifications", "Бюджет, количество и комплектация"),
      localized("交付需求与沟通重点", "Delivery needs and key questions", "Условия передачи и ключевые вопросы"),
    ],
  },
  {
    title: localized("车源匹配", "Match vehicle supply", "Подбор автомобилей"),
    summary: localized("结合中国市场车源与供应渠道，整理可比较的车型和采购方案。", "We use vehicle supply in China and our sourcing channels to prepare comparable models and purchasing options.", "Используем предложения китайского рынка и каналы поставок, чтобы подготовить сопоставимые модели и варианты закупки."),
    details: [
      localized("品牌与配置对比", "Compare brands and specifications", "Сравнение марок и комплектаций"),
      localized("车源信息核对", "Review available vehicle information", "Проверка информации об автомобилях"),
      localized("采购方案沟通", "Discuss purchasing options", "Обсуждение вариантов закупки"),
    ],
  },
  {
    title: localized("验车与资料", "Inspection and documents", "Проверка и документы"),
    summary: localized("围绕车况、配置和出口资料逐项核验，让发运前的关键信息更清晰。", "We review condition, specifications, and export documents so the key information is clear before dispatch.", "Проверяем состояние, комплектацию и экспортные документы, чтобы важные сведения были ясны до отправки."),
    details: [
      localized("车况与配置核验", "Check condition and specifications", "Проверка состояния и комплектации"),
      localized("出口资料准备", "Prepare export documents", "Подготовка экспортных документов"),
      localized("关键资料同步", "Share essential records", "Передача ключевых документов"),
    ],
  },
  {
    title: localized("跨境运输", "Cross-border logistics", "Международная логистика"),
    summary: localized("结合目的地和订单要求，协调口岸、运输与交接节点。", "We coordinate port handling, transport, and handoff points around the destination and order requirements.", "Согласуем работу на пограничном переходе, перевозку и этапы передачи с учётом заказа и пункта назначения."),
    details: [
      localized("绥芬河口岸衔接", "Suifenhe port coordination", "Взаимодействие через переход Суйфэньхэ"),
      localized("运输安排沟通", "Discuss transport arrangements", "Согласование перевозки"),
      localized("节点进度反馈", "Updates at key stages", "Информация о ключевых этапах"),
    ],
  },
  {
    title: localized("交付跟进", "Handover and follow-up", "Передача и сопровождение"),
    summary: localized("保持交付信息透明，确认车辆与资料交接，并持续回应后续问题。", "We keep delivery information clear, confirm the vehicle and document handover, and respond to follow-up questions.", "Сообщаем информацию о доставке, подтверждаем передачу автомобиля и документов и отвечаем на последующие вопросы."),
    details: [
      localized("到货信息同步", "Share arrival information", "Информация о прибытии"),
      localized("车辆与资料交接", "Vehicle and document handover", "Передача автомобиля и документов"),
      localized("后续沟通", "Follow-up communication", "Дальнейшая связь"),
    ],
  },
];

const regionIntro = localized(
  "以绥芬河口岸为连接点，面向俄罗斯及中亚五国协调车源、资料与跨境交付。选择国家，了解合作方向。",
  "From the Suifenhe port, we connect vehicle supply, documents, and cross-border delivery for Russia and five Central Asian countries. Select a country to explore the approach.",
  "Через переход Суйфэньхэ мы координируем поставку автомобилей, документы и международную доставку для России и пяти стран Центральной Азии. Выберите страну, чтобы узнать больше.",
);

const regionCapabilities: Localized[] = [
  localized("车源匹配", "Vehicle sourcing", "Подбор автомобилей"),
  localized("出口资料", "Export documents", "Экспортные документы"),
  localized("物流协同", "Logistics coordination", "Координация логистики"),
];

const regions: Array<{ name: Localized; summary: Localized }> = [
  {
    name: localized("俄罗斯", "Russia", "Россия"),
    summary: localized("依托绥芬河口岸和中俄两地团队，衔接车辆采购、报关及境外仓储销售。", "Our Suifenhe port base and teams in China and Russia connect sourcing, customs declaration, and overseas warehousing and sales.", "База в Суйфэньхэ и команды в Китае и России связывают закупку, таможенное оформление, зарубежное хранение и продажи."),
  },
  {
    name: localized("哈萨克斯坦", "Kazakhstan", "Казахстан"),
    summary: localized("围绕市场车型偏好与采购需求，梳理车源、出口资料和跨境交付方案。", "We shape vehicle, document, and cross-border delivery options around market preferences and purchasing needs.", "Подбираем автомобили, документы и варианты международной доставки с учётом спроса и задач закупки."),
  },
  {
    name: localized("吉尔吉斯斯坦", "Kyrgyzstan", "Кыргызстан"),
    summary: localized("结合订单规模与交付要求，协调车型选择、资料准备和运输节点。", "We coordinate model selection, document preparation, and transport stages around each order and handover brief.", "Согласуем выбор моделей, подготовку документов и этапы перевозки с учётом заказа и условий передачи."),
  },
  {
    name: localized("乌兹别克斯坦", "Uzbekistan", "Узбекистан"),
    summary: localized("从车型配置到资料准备，帮助合作伙伴明确采购与交接环节。", "From specifications to document preparation, we help partners make purchasing and handover steps clear.", "От комплектации до подготовки документов помогаем партнёрам уточнить этапы закупки и передачи."),
  },
  {
    name: localized("塔吉克斯坦", "Tajikistan", "Таджикистан"),
    summary: localized("按项目需求匹配车源与跨境运输安排，并同步关键节点信息。", "We align vehicle supply and cross-border transport with the project brief and share updates at key stages.", "Согласуем подбор автомобилей и международную перевозку с задачами проекта и сообщаем о ключевых этапах."),
  },
  {
    name: localized("土库曼斯坦", "Turkmenistan", "Туркменистан"),
    summary: localized("结合具体采购计划，沟通车源、出口资料和交付安排。", "We discuss vehicle supply, export documents, and delivery arrangements around each purchasing plan.", "Обсуждаем автомобили, экспортные документы и передачу с учётом конкретного плана закупки."),
  },
];

function renderEntry(title: string, summary: string, details: string[]): string {
  return `<li><strong>${escapeHtml(title)}</strong><p>${escapeHtml(summary)}</p><ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul></li>`;
}

function buildBodies(): Record<ServiceModuleId, Localized> {
  const process = {} as Localized;
  const serviceRegions = {} as Localized;
  for (const language of languages) {
    process[language] = `<ol>${processSteps.map((step) => renderEntry(step.title[language], step.summary[language], step.details.map((detail) => detail[language]))).join("")}</ol>`;
    serviceRegions[language] = `<p>${escapeHtml(regionIntro[language])}</p><ul>${regions.map((region) => renderEntry(region.name[language], region.summary[language], regionCapabilities.map((item) => item[language]))).join("")}</ul>`;
  }
  return { "home-service-process": process, "home-service-regions": serviceRegions };
}

export const serviceModuleBodies = buildBodies();

export function upgradeServiceModuleBodies(value: unknown): { content: Record<string, unknown>; changed: boolean } {
  const content = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (!Array.isArray(content.customModules)) return { content, changed: false };
  let changed = false;
  const modules: unknown[] = content.customModules;
  const customModules = modules.map((item: unknown): unknown => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const module = item as Record<string, unknown>;
    const id = module.id;
    if (id !== "home-service-process" && id !== "home-service-regions") return item;
    const body = module.body && typeof module.body === "object" && !Array.isArray(module.body)
      ? module.body as Record<string, unknown> : {};
    let bodyChanged = false;
    const nextBody = { ...body };
    for (const language of languages) {
      const current = body[language];
      if (typeof current === "string" && canonicalLegacyMarkup(current) === canonicalLegacyMarkup(legacyServiceModuleBodies[id][language])) {
        nextBody[language] = serviceModuleBodies[id][language];
        bodyChanged = true;
      }
    }
    if (!bodyChanged) return item;
    changed = true;
    return { ...module, body: nextBody };
  });
  return changed ? { content: { ...content, customModules }, changed } : { content, changed };
}
