import { getCurrentUser } from "./user";

interface RouteMeta {
  title: string;
  icon?: string;
  rank?: number;
  showLink?: boolean;
  activePath?: string;
  vehiclePreset?: CustomizeRouteMeta["vehiclePreset"];
  catalogKind?: CustomizeRouteMeta["catalogKind"];
  homepageView?: CustomizeRouteMeta["homepageView"];
  mediaPreset?: CustomizeRouteMeta["mediaPreset"];
  inquiryPreset?: CustomizeRouteMeta["inquiryPreset"];
  settingsGroup?: CustomizeRouteMeta["settingsGroup"];
}

interface RouteItem {
  path: string;
  name: string;
  component?: string;
  permission: string;
  meta: RouteMeta;
  children?: RouteItem[];
}

type FilteredRouteItem = Omit<RouteItem, "permission" | "children"> & {
  children?: FilteredRouteItem[];
};

const routeCatalog: RouteItem[] = [
  {
    path: "/dashboard",
    name: "Dashboard",
    component: "dashboard/index",
    permission: "dashboard:view",
    meta: { title: "数据概览", icon: "ri/dashboard-3-line", rank: 1 }
  },
  {
    path: "/vehicles",
    name: "Vehicles",
    permission: "vehicle:view",
    meta: { title: "车辆管理", icon: "ri/car-line", rank: 2 },
    children: [
      {
        path: "/vehicles/list",
        name: "VehicleList",
        component: "vehicle/index",
        permission: "vehicle:view",
        meta: { title: "车辆列表" }
      },
      {
        path: "/vehicles/new",
        name: "NewVehicles",
        component: "vehicle/index",
        permission: "vehicle:view",
        meta: { title: "新车管理", vehiclePreset: { type: "NEW" } }
      },
      {
        path: "/vehicles/used",
        name: "UsedVehicles",
        component: "vehicle/index",
        permission: "vehicle:view",
        meta: { title: "二手车管理", vehiclePreset: { type: "USED" } }
      },
      {
        path: "/vehicles/sold",
        name: "SoldVehicles",
        component: "vehicle/index",
        permission: "vehicle:view",
        meta: {
          title: "已售车辆",
          vehiclePreset: { saleStatus: "SOLD" }
        }
      },
      {
        path: "/vehicles/drafts",
        name: "DraftVehicles",
        component: "vehicle/index",
        permission: "vehicle:view",
        meta: { title: "草稿箱", vehiclePreset: { status: "DRAFT" } }
      },
      {
        path: "/vehicles/create",
        name: "VehicleCreate",
        component: "vehicle/form",
        permission: "vehicle:create",
        meta: { title: "新增车辆" }
      },
      {
        path: "/vehicles/edit/:id",
        name: "VehicleEdit",
        component: "vehicle/form",
        permission: "vehicle:update",
        meta: {
          title: "编辑车辆",
          showLink: false,
          activePath: "/vehicles/list"
        }
      },
      {
        path: "/vehicles/brands",
        name: "VehicleBrands",
        component: "vehicle/catalog",
        permission: "brand:view",
        meta: { title: "品牌管理", catalogKind: "brands" }
      },
      {
        path: "/vehicles/series",
        name: "VehicleSeries",
        component: "vehicle/catalog",
        permission: "brand:view",
        meta: { title: "车系管理", catalogKind: "series" }
      },
      {
        path: "/vehicles/models",
        name: "VehicleModels",
        component: "vehicle/catalog",
        permission: "brand:view",
        meta: { title: "车型管理", catalogKind: "models" }
      },
      {
        path: "/vehicles/categories",
        name: "VehicleCategories",
        component: "vehicle/catalog",
        permission: "vehicle:view",
        meta: { title: "车辆分类", catalogKind: "categories" }
      },
      {
        path: "/vehicles/tags",
        name: "VehicleTags",
        component: "vehicle/catalog",
        permission: "vehicle:view",
        meta: { title: "车辆标签", catalogKind: "tags" }
      }
    ]
  },
  {
    path: "/homepage",
    name: "Homepage",
    permission: "homepage:view",
    meta: { title: "首页管理", icon: "ri/layout-grid-line", rank: 3 },
    children: [
      {
        path: "/homepage/banners",
        name: "Banners",
        component: "homepage/banners",
        permission: "banner:view",
        meta: { title: "轮播图" }
      },
      {
        path: "/homepage/sections",
        name: "HomepageSections",
        component: "homepage/sections",
        permission: "homepage:view",
        meta: { title: "首页模块", homepageView: "modules" }
      },
      {
        path: "/homepage/recommendations",
        name: "HomepageRecommendations",
        component: "homepage/sections",
        permission: "homepage:view",
        meta: { title: "推荐车辆", homepageView: "recommendations" }
      },
      {
        path: "/homepage/brands",
        name: "HomepageBrands",
        component: "homepage/sections",
        permission: "homepage:view",
        meta: { title: "品牌展示", homepageView: "brands" }
      },
      {
        path: "/homepage/features",
        name: "HomepageFeatures",
        component: "homepage/features",
        permission: "homepage:view",
        meta: { title: "优势图标" }
      },
      {
        path: "/homepage/video",
        name: "HomepageVideo",
        component: "homepage/sections",
        permission: "homepage:view",
        meta: { title: "首页视频", homepageView: "video" }
      },
      {
        path: "/homepage/about",
        name: "HomepageAbout",
        component: "homepage/sections",
        permission: "homepage:view",
        meta: { title: "公司简介", homepageView: "about" }
      },
      {
        path: "/homepage/cta",
        name: "HomepageCta",
        component: "homepage/sections",
        permission: "homepage:view",
        meta: { title: "行动按钮", homepageView: "cta" }
      }
    ]
  },
  {
    path: "/content",
    name: "Content",
    permission: "content:view",
    meta: { title: "网站内容", icon: "ri/file-text-line", rank: 4 },
    children: [
      {
        path: "/homepage/content",
        name: "HomepageContent",
        component: "homepage/content",
        permission: "content:view",
        meta: { title: "首页展示内容" }
      },
      {
        path: "/content/pages",
        name: "Pages",
        component: "content/pages",
        permission: "content:view",
        meta: { title: "页面管理" }
      },
      {
        path: "/content/pages/create",
        name: "PageCreate",
        component: "content/page-form",
        permission: "content:manage",
        meta: {
          title: "新增页面",
          showLink: false,
          activePath: "/content/pages"
        }
      },
      {
        path: "/content/pages/edit/:id",
        name: "PageEdit",
        component: "content/page-form",
        permission: "content:manage",
        meta: {
          title: "编辑页面",
          showLink: false,
          activePath: "/content/pages"
        }
      },
      {
        path: "/content/navigation",
        name: "Navigation",
        component: "content/navigation",
        permission: "content:view",
        meta: { title: "导航菜单" }
      },
      {
        path: "/content/footer",
        name: "ContentFooter",
        component: "system/settings",
        permission: "settings:view",
        meta: { title: "页脚管理", settingsGroup: "footer" }
      },
      {
        path: "/content/contact",
        name: "ContentContact",
        component: "system/settings",
        permission: "settings:view",
        meta: { title: "联系方式", settingsGroup: "contact" }
      },
      {
        path: "/content/social",
        name: "ContentSocial",
        component: "system/settings",
        permission: "settings:view",
        meta: { title: "社交媒体", settingsGroup: "social" }
      },
      {
        path: "/content/seo",
        name: "ContentSeo",
        component: "system/settings",
        permission: "settings:view",
        meta: { title: "SEO 设置", settingsGroup: "seo" }
      }
    ]
  },
  {
    path: "/media",
    name: "Media",
    permission: "media:view",
    meta: { title: "素材管理", icon: "ri/image-line", rank: 5 },
    children: [
      {
        path: "/media/images",
        name: "MediaImages",
        component: "media/index",
        permission: "media:view",
        meta: { title: "图片库", mediaPreset: { mimeGroup: "image" } }
      },
      {
        path: "/media/videos",
        name: "MediaVideos",
        component: "media/index",
        permission: "media:view",
        meta: { title: "视频库", mediaPreset: { mimeGroup: "video" } }
      },
      {
        path: "/media/folders",
        name: "MediaFolders",
        component: "media/index",
        permission: "media:view",
        meta: { title: "文件夹管理" }
      },
      {
        path: "/media/uploads",
        name: "MediaUploads",
        component: "media/uploads",
        permission: "media:view",
        meta: { title: "上传记录" }
      }
    ]
  },
  {
    path: "/inquiries",
    name: "Inquiries",
    permission: "inquiry:list",
    meta: {
      title: "客户管理",
      icon: "ri/customer-service-2-line",
      rank: 6
    },
    children: [
      {
        path: "/inquiries/records",
        name: "InquiryRecords",
        component: "inquiry/index",
        permission: "inquiry:list",
        meta: { title: "询价记录" }
      },
      {
        path: "/inquiries/messages",
        name: "ContactMessages",
        component: "inquiry/index",
        permission: "inquiry:list",
        meta: {
          title: "联系留言",
          inquiryPreset: { source: "WEBSITE" }
        }
      },
      {
        path: "/inquiries/whatsapp",
        name: "WhatsappInquiries",
        component: "inquiry/index",
        permission: "inquiry:list",
        meta: {
          title: "WhatsApp 咨询",
          inquiryPreset: { source: "WHATSAPP" }
        }
      },
      {
        path: "/inquiries/notes",
        name: "InquiryNotes",
        component: "inquiry/notes",
        permission: "inquiry:note",
        meta: { title: "客户备注" }
      },
      {
        path: "/inquiries/export",
        name: "InquiryExport",
        component: "inquiry/index",
        permission: "inquiry:export",
        meta: { title: "数据导出" }
      }
    ]
  },
  {
    path: "/permissions",
    name: "Permissions",
    permission: "user:view",
    meta: { title: "权限管理", icon: "ri/shield-user-line", rank: 7 },
    children: [
      {
        path: "/permissions/users",
        name: "Users",
        component: "permission/users",
        permission: "user:view",
        meta: { title: "管理员" }
      },
      {
        path: "/permissions/roles",
        name: "Roles",
        component: "permission/roles",
        permission: "role:view",
        meta: { title: "角色权限" }
      },
      {
        path: "/permissions/list",
        name: "PermissionList",
        component: "permission/permissions",
        permission: "permission:view",
        meta: { title: "权限列表" }
      }
    ]
  },
  {
    path: "/system",
    name: "System",
    permission: "settings:view",
    meta: { title: "系统管理", icon: "ri/settings-3-line", rank: 8 },
    children: [
      {
        path: "/system/settings",
        name: "Settings",
        component: "system/settings",
        permission: "settings:view",
        meta: { title: "网站设置", settingsGroup: "basic" }
      },
      {
        path: "/system/translation-model",
        name: "TranslationModelSettings",
        component: "system/translation-model",
        permission: "settings:view",
        meta: { title: "API 模型配置" }
      },
      {
        path: "/system/storage",
        name: "StorageSettings",
        component: "system/storage",
        permission: "storage-settings:view",
        meta: { title: "文件存储" }
      },
      {
        path: "/system/mail",
        name: "MailSettings",
        component: "system/mail",
        permission: "mail-settings:view",
        meta: { title: "邮件设置" }
      },
      {
        path: "/system/audit",
        name: "AuditLogs",
        component: "system/audit",
        permission: "audit:view",
        meta: { title: "操作日志" }
      },
      {
        path: "/system/login-logs",
        name: "LoginLogs",
        component: "system/login-logs",
        permission: "login-log:view",
        meta: { title: "登录日志" }
      },
      {
        path: "/system/logs",
        name: "SystemLogs",
        component: "system/system-logs",
        permission: "system-log:view",
        meta: { title: "系统日志" }
      },
      {
        path: "/system/info",
        name: "SystemInfo",
        component: "system/system-info",
        permission: "system-info:view",
        meta: { title: "系统信息" }
      }
    ]
  }
];

function filterRoutes(
  routes: RouteItem[],
  permissions: Set<string>
): FilteredRouteItem[] {
  return routes.flatMap(route => {
    const children = route.children
      ? filterRoutes(route.children as RouteItem[], permissions)
      : undefined;
    if (!permissions.has(route.permission) && !children?.length) return [];
    const { permission: _permission, ...clean } = route;
    return [{ ...clean, ...(children ? { children } : {}) }];
  });
}

export const getAsyncRoutes = async () => {
  const user = await getCurrentUser();
  return {
    success: true,
    data: filterRoutes(routeCatalog, new Set(user.permissions))
  };
};
