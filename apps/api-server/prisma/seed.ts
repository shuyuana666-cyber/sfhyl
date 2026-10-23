import {
  AdminUserStatus,
  BannerStatus,
  ContentStatus,
  FeatureIconType,
  HomepageSectionType,
  LinkTarget,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedBrands } from "./brand-defaults";

const prisma = new PrismaClient();

const permissions = [
  ["dashboard:view", "dashboard", "查看数据概览", "View dashboard"],
  ["vehicle:view", "vehicle", "查看车辆", "View vehicles"],
  ["vehicle:create", "vehicle", "新增车辆", "Create vehicles"],
  ["vehicle:update", "vehicle", "编辑车辆", "Update vehicles"],
  ["vehicle:delete", "vehicle", "删除车辆", "Delete vehicles"],
  ["vehicle:publish", "vehicle", "发布车辆", "Publish vehicles"],
  ["vehicle:offline", "vehicle", "下架车辆", "Take vehicles offline"],
  ["vehicle:restore", "vehicle", "恢复车辆", "Restore vehicles"],
  ["vehicle:batch", "vehicle", "批量操作车辆", "Run vehicle batch actions"],
  ["vehicle:export", "vehicle", "导出车辆", "Export vehicles"],
  ["brand:view", "catalog", "查看品牌", "View brands"],
  ["brand:manage", "catalog", "管理品牌", "Manage brands"],
  ["series:manage", "catalog", "管理车系", "Manage vehicle series"],
  ["model:manage", "catalog", "管理车型", "Manage vehicle models"],
  ["category:manage", "catalog", "管理车辆分类", "Manage vehicle categories"],
  ["tag:manage", "catalog", "管理车辆标签", "Manage vehicle tags"],
  ["banner:view", "homepage", "查看轮播图", "View banners"],
  ["banner:create", "homepage", "新增轮播图", "Create banners"],
  ["banner:update", "homepage", "编辑轮播图", "Update banners"],
  ["banner:delete", "homepage", "删除轮播图", "Delete banners"],
  ["banner:sort", "homepage", "轮播图排序", "Sort banners"],
  ["homepage:view", "homepage", "查看首页配置", "View homepage configuration"],
  [
    "homepage:manage",
    "homepage",
    "管理首页配置",
    "Manage homepage configuration",
  ],
  ["content:view", "content", "查看网站内容", "View website content"],
  ["content:manage", "content", "管理网站内容", "Manage website content"],
  ["navigation:manage", "content", "管理导航菜单", "Manage navigation"],
  ["settings:view", "system", "查看网站设置", "View site settings"],
  ["settings:update", "system", "修改网站设置", "Update site settings"],
  ["media:view", "media", "查看素材", "View media"],
  ["media:upload", "media", "上传素材", "Upload media"],
  ["media:delete", "media", "删除素材", "Delete media"],
  ["inquiry:list", "inquiry", "查看询盘列表", "List inquiries"],
  ["inquiry:view", "inquiry", "查看询盘详情", "View inquiry details"],
  ["inquiry:update", "inquiry", "处理询盘", "Update inquiries"],
  ["inquiry:assign", "inquiry", "分配询盘", "Assign inquiries"],
  ["inquiry:note", "inquiry", "添加询盘备注", "Add inquiry notes"],
  ["inquiry:export", "inquiry", "导出询盘", "Export inquiries"],
  ["user:view", "permission", "查看管理员", "View administrators"],
  ["user:create", "permission", "新增管理员", "Create administrators"],
  ["user:update", "permission", "编辑管理员", "Update administrators"],
  ["user:disable", "permission", "停用管理员", "Disable administrators"],
  ["role:view", "permission", "查看角色", "View roles"],
  ["role:create", "permission", "新增角色", "Create roles"],
  ["role:update", "permission", "编辑角色", "Update roles"],
  ["role:delete", "permission", "删除角色", "Delete roles"],
  ["permission:view", "permission", "查看权限", "View permissions"],
  ["audit:view", "audit", "查看操作日志", "View audit logs"],
  ["login-log:view", "audit", "查看登录日志", "View login logs"],
  ["system-log:view", "system", "查看系统日志", "View system logs"],
  [
    "storage-settings:view",
    "system",
    "查看文件存储配置",
    "View storage settings",
  ],
  ["mail-settings:view", "system", "查看邮件配置", "View mail settings"],
  ["system-info:view", "system", "查看系统信息", "View system information"],
] as const;

const roleDefinitions = [
  {
    code: "super_admin",
    nameZh: "超级管理员",
    nameEn: "Super Administrator",
    description: "Full platform access.",
    permissionCodes: permissions.map(([code]) => code),
  },
  {
    code: "content_operator",
    nameZh: "内容运营",
    nameEn: "Content Operator",
    description: "Website content, homepage, navigation, and media operations.",
    permissionCodes: [
      "dashboard:view",
      "banner:view",
      "banner:create",
      "banner:update",
      "banner:delete",
      "banner:sort",
      "homepage:view",
      "homepage:manage",
      "content:view",
      "content:manage",
      "navigation:manage",
      "settings:view",
      "media:view",
      "media:upload",
    ],
  },
  {
    code: "vehicle_editor",
    nameZh: "车辆编辑",
    nameEn: "Vehicle Editor",
    description: "Vehicle catalogue and associated media operations.",
    permissionCodes: [
      "dashboard:view",
      "vehicle:view",
      "vehicle:create",
      "vehicle:update",
      "vehicle:publish",
      "vehicle:offline",
      "vehicle:restore",
      "vehicle:batch",
      "vehicle:export",
      "brand:view",
      "brand:manage",
      "series:manage",
      "model:manage",
      "category:manage",
      "tag:manage",
      "media:view",
      "media:upload",
    ],
  },
  {
    code: "customer_service",
    nameZh: "客户客服",
    nameEn: "Customer Service",
    description:
      "Inquiry processing without vehicle deletion or site-setting access.",
    permissionCodes: [
      "dashboard:view",
      "vehicle:view",
      "inquiry:list",
      "inquiry:view",
      "inquiry:update",
      "inquiry:assign",
      "inquiry:note",
      "inquiry:export",
    ],
  },
  {
    code: "read_only",
    nameZh: "只读管理员",
    nameEn: "Read-only Administrator",
    description: "Read-only access to operational data.",
    permissionCodes: [
      "dashboard:view",
      "vehicle:view",
      "brand:view",
      "banner:view",
      "homepage:view",
      "content:view",
      "settings:view",
      "media:view",
      "inquiry:list",
      "inquiry:view",
      "user:view",
      "role:view",
      "permission:view",
      "audit:view",
      "login-log:view",
      "system-log:view",
      "storage-settings:view",
      "mail-settings:view",
      "system-info:view",
    ],
  },
] as const;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for database seeding.`);
  return value;
}

function validateSeedPassword(value: string): void {
  const placeholder = /replace|password|example/i.test(value);
  const strongEnough =
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value);
  if (placeholder || !strongEnough) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be at least 12 characters and contain upper-case, lower-case, and numeric characters.",
    );
  }
}

async function seedPermissionsAndRoles(): Promise<Map<string, bigint>> {
  const permissionIds = new Map<string, bigint>();

  for (const [code, module, nameZh, nameEn] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { module, nameZh, nameEn },
      create: { code, module, nameZh, nameEn },
    });
    permissionIds.set(code, permission.id);
  }

  const roleIds = new Map<string, bigint>();
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: {
        nameZh: definition.nameZh,
        nameEn: definition.nameEn,
        description: definition.description,
        isSystem: true,
        isEnabled: true,
        deletedAt: null,
      },
      create: {
        code: definition.code,
        nameZh: definition.nameZh,
        nameEn: definition.nameEn,
        description: definition.description,
        isSystem: true,
      },
    });
    roleIds.set(definition.code, role.id);

    const desiredPermissionIds = definition.permissionCodes.map((code) => {
      const permissionId = permissionIds.get(code);
      if (!permissionId)
        throw new Error(`Unknown permission in role seed: ${code}`);
      return permissionId;
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: desiredPermissionIds } },
    });
    for (const permissionId of desiredPermissionIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  return roleIds;
}

async function seedAdministrator(superAdminRoleId: bigint): Promise<void> {
  const username = requiredEnvironment("SEED_ADMIN_USERNAME");
  const email = requiredEnvironment("SEED_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnvironment("SEED_ADMIN_PASSWORD");
  validateSeedPassword(password);

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.upsert({
    where: { username },
    update: { email },
    create: {
      username,
      email,
      passwordHash,
      displayName: "Platform Administrator",
      status: AdminUserStatus.ACTIVE,
      passwordChangedAt: new Date(),
    },
  });

  await prisma.adminUserRole.upsert({
    where: {
      adminUserId_roleId: { adminUserId: admin.id, roleId: superAdminRoleId },
    },
    update: {},
    create: { adminUserId: admin.id, roleId: superAdminRoleId },
  });
}

async function seedSiteConfiguration(): Promise<void> {
  const settings: Array<{
    group: string;
    key: string;
    value: Prisma.InputJsonValue;
    description: string;
  }> = [
    {
      group: "basic",
      key: "siteNameZh",
      value: "SFHYL.CN",
      description: "Chinese website name",
    },
    {
      group: "basic",
      key: "siteNameEn",
      value: "SFHYL.CN",
      description: "English website name",
    },
    {
      group: "basic",
      key: "siteNameRu",
      value: "SFHYL.CN",
      description: "Russian website name",
    },
    {
      group: "basic",
      key: "shortName",
      value: "SFHYL.CN",
      description: "Header brand name",
    },
    {
      group: "basic",
      key: "defaultLanguage",
      value: "ru",
      description: "Default public language",
    },
    {
      group: "basic",
      key: "defaultCurrency",
      value: "CNY",
      description: "Default vehicle currency",
    },
    {
      group: "basic",
      key: "timezone",
      value: "Asia/Shanghai",
      description: "Business timezone",
    },
    {
      group: "branding",
      key: "logoUrl",
      value: "",
      description: "Primary logo URL",
    },
    {
      group: "branding",
      key: "darkLogoUrl",
      value: "",
      description: "Dark-background logo URL",
    },
    {
      group: "branding",
      key: "mobileLogoUrl",
      value: "",
      description: "Mobile logo URL",
    },
    {
      group: "branding",
      key: "faviconUrl",
      value: "",
      description: "Browser favicon URL",
    },
    { group: "contact", key: "phone", value: "", description: "Contact phone" },
    {
      group: "contact",
      key: "whatsapp",
      value: "79140693189",
      description: "WhatsApp number without punctuation",
    },
    { group: "contact", key: "email", value: "", description: "Contact email" },
    {
      group: "social",
      key: "facebook",
      value: "",
      description: "Facebook profile URL",
    },
    {
      group: "social",
      key: "instagram",
      value: "",
      description: "Instagram profile URL",
    },
    {
      group: "social",
      key: "youtube",
      value: "",
      description: "YouTube channel URL",
    },
    {
      group: "social",
      key: "linkedin",
      value: "",
      description: "LinkedIn profile URL",
    },
    {
      group: "social",
      key: "tiktok",
      value: "",
      description: "TikTok profile URL",
    },
    { group: "social", key: "x", value: "", description: "X profile URL" },
    { group: "social", key: "vk", value: "", description: "VK profile URL" },
    {
      group: "footer",
      key: "copyright",
      value: "",
      description: "Footer copyright text",
    },
    {
      group: "features",
      key: "maintenanceMode",
      value: false,
      description: "Public-site maintenance mode",
    },
  ];

  for (const setting of settings) {
    await prisma.siteSetting.upsert({
      where: { group_key: { group: setting.group, key: setting.key } },
      update: {
        description: setting.description,
        isPublic: true,
        isSensitive: false,
      },
      create: { ...setting, isPublic: true, isSensitive: false },
    });
  }

  await prisma.siteSetting.updateMany({
    where: {
      group: "footer",
      key: "copyright",
      value: { equals: "Copyright © 2026 SFHYL.CN" },
    },
    data: { value: "" },
  });

  const navigationItems = [
    {
      key: "home",
      labelZh: "首页",
      labelEn: "Home",
      labelRu: "Главная",
      href: "/",
      sortOrder: 10,
    },
    {
      key: "contact",
      labelZh: "联系我们",
      labelEn: "Contact",
      labelRu: "Контакты",
      href: "/contact",
      sortOrder: 30,
    },
  ];
  for (const item of navigationItems) {
    await prisma.navigationItem.upsert({
      where: { key: item.key },
      update: {},
      create: {
        ...item,
        target:
          item.key === "tracking" ? LinkTarget.NEW_TAB : LinkTarget.SAME_TAB,
      },
    });
  }

  await prisma.page.upsert({
    where: { slug: "about" },
    update: {},
    create: {
      slug: "about",
      titleZh: "关于我们",
      titleEn: "About us",
      titleRu: "О нас",
      content: { blocks: [] },
    },
  });

  await prisma.page.upsert({
    where: { slug: "homepage-content" },
    update: {},
    create: {
      slug: "homepage-content",
      titleZh: "首页内容",
      titleEn: "Homepage content",
      content: {
        hero: [],
        about: { title: { zh: "关于我们", en: "About us", ru: "About us" }, body: { zh: "", en: "", ru: "" }, button: { label: { zh: "了解更多", en: "Learn more", ru: "Learn more" }, href: "#about" }, videoMediaId: null, posterMediaId: null },
        transport: { title: { zh: "运输与交付", en: "Transportation and delivery", ru: "Transportation and delivery" }, items: [] },
        staff: { title: { zh: "优秀员工", en: "Our team", ru: "Our team" }, items: [] },
        videos: { title: { zh: "视频", en: "Video", ru: "Video" }, items: [] },
        quickNav: { title: { zh: "快捷导航", en: "Quick navigation", ru: "Quick navigation" }, items: [] },
        locations: { title: { zh: "办公室与停车场", en: "Offices and parking yards", ru: "Offices and parking yards" }, items: [] },
      },
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });
}

async function seedHomepage(): Promise<void> {
  const sections = [
    ["banner", HomepageSectionType.BANNER, 10, 5],
    ["vehicle-search", HomepageSectionType.VEHICLE_SEARCH, 20, null],
    ["featured-vehicles", HomepageSectionType.FEATURED_VEHICLES, 30, 12],
    ["latest-vehicles", HomepageSectionType.LATEST_VEHICLES, 40, 12],
    ["new-vehicles", HomepageSectionType.NEW_VEHICLES, 50, 12],
    ["used-vehicles", HomepageSectionType.USED_VEHICLES, 60, 12],
    ["brands", HomepageSectionType.BRANDS, 70, 12],
    ["features", HomepageSectionType.FEATURES, 80, 4],
    ["about", HomepageSectionType.ABOUT, 90, null],
    ["video", HomepageSectionType.VIDEO, 100, 1],
    ["contact", HomepageSectionType.CONTACT, 110, null],
    ["cta", HomepageSectionType.CTA, 120, null],
  ] as const;

  for (const [key, type, sortOrder, displayCount] of sections) {
    await prisma.homepageSection.upsert({
      where: { key },
      update: {},
      create: { key, type, sortOrder, displayCount, isEnabled: true },
    });
  }

  const featureItems = [
    [
      "quality-assurance",
      "品质保障",
      "Quality Assurance",
      "Контроль качества",
      "ShieldCheck",
      10,
      "采购前核对车况、配置与出口资料，让车辆信息和交付事项清晰可查。",
      "Check vehicle condition, specifications, and export documents before purchase, with clear handoffs through delivery.",
      "До покупки проверяем состояние, комплектацию и экспортные документы и держим этапы доставки на виду.",
    ],
    [
      "global-shipping",
      "全球运输",
      "Global Shipping",
      "Международная доставка",
      "Ship",
      20,
      "协调报关、口岸和跨境运输，持续同步车辆交付进度。",
      "Coordinate customs clearance, port handling, and cross-border transport, with updates through delivery.",
      "Координируем таможенное оформление, работу на погранпереходе и перевозку, сообщая о ходе доставки.",
    ],
    [
      "professional-service",
      "专业服务",
      "Professional Service",
      "Профессиональный сервис",
      "Users",
      30,
      "从车型筛选、询价到出口手续衔接，提供清晰的采购支持。",
      "Get support with vehicle selection, quotations, and export arrangements.",
      "Помогаем с подбором автомобиля, запросом цены и организацией экспортных процедур.",
    ],
    [
      "after-sales",
      "售后支持",
      "After-sales Support",
      "Послепродажная поддержка",
      "Headphones",
      40,
      "交付后持续响应咨询，协助处理车辆使用和配件相关需求。",
      "Contact our team after delivery for vehicle-use and parts-related questions.",
      "После доставки остаёмся на связи и помогаем с вопросами по эксплуатации автомобиля и запчастям.",
    ],
  ] as const;
  for (const [
    key,
    titleZh,
    titleEn,
    titleRu,
    iconName,
    sortOrder,
    descriptionZh,
    descriptionEn,
    descriptionRu,
  ] of featureItems) {
    await prisma.featureItem.upsert({
      where: { key },
      update: {},
      create: {
        key,
        titleZh,
        titleEn,
        titleRu,
        descriptionZh,
        descriptionEn,
        descriptionRu,
        iconType: FeatureIconType.BUILTIN,
        iconName,
        sortOrder,
      },
    });
  }

  await prisma.banner.upsert({
    where: { key: "legacy-home-banner" },
    update: {},
    create: {
      key: "legacy-home-banner",
      titleZh: "现有首页轮播图待迁移",
      titleEn: "Existing homepage banner pending migration",
      titleRu: "Текущий баннер ожидает миграции",
      status: BannerStatus.DRAFT,
      sortOrder: 10,
    },
  });
}

async function seedCategories(): Promise<void> {
  const categories = [
    ["suv", "SUV", "SUV"],
    ["sedan", "轿车", "Sedan"],
    ["mpv", "MPV", "MPV"],
    ["pickup", "皮卡", "Pickup"],
  ] as const;
  for (const [index, [slug, nameZh, nameEn]] of categories.entries()) {
    await prisma.vehicleCategory.upsert({
      where: { slug },
      update: {},
      create: { slug, nameZh, nameEn, sortOrder: (index + 1) * 10 },
    });
  }
}

async function main(): Promise<void> {
  const roleIds = await seedPermissionsAndRoles();
  const superAdminRoleId = roleIds.get("super_admin");
  if (!superAdminRoleId)
    throw new Error("Super administrator role was not seeded.");

  await seedAdministrator(superAdminRoleId);
  await seedSiteConfiguration();
  await seedHomepage();
  await seedBrands(prisma);
  await seedCategories();

  console.log("Database seed completed successfully.");
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
