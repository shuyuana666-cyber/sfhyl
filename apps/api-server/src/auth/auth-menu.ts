interface MenuItem {
  path: string;
  title: string;
  permission?: string;
  children?: MenuItem[];
}

const ADMIN_MENU: MenuItem[] = [
  { path: "/dashboard", title: "数据概览", permission: "dashboard:view" },
  {
    path: "/vehicles",
    title: "车辆管理",
    permission: "vehicle:view",
    children: [
      { path: "/vehicles/list", title: "全部车辆", permission: "vehicle:view" },
      {
        path: "/vehicles/create",
        title: "添加车辆",
        permission: "vehicle:create",
      },
      { path: "/vehicles/new", title: "新车管理", permission: "vehicle:view" },
      {
        path: "/vehicles/used",
        title: "二手车管理",
        permission: "vehicle:view",
      },
      { path: "/vehicles/sold", title: "已售车辆", permission: "vehicle:view" },
      { path: "/vehicles/drafts", title: "草稿箱", permission: "vehicle:view" },
      { path: "/vehicles/brands", title: "品牌管理", permission: "brand:view" },
      { path: "/vehicles/series", title: "车系管理", permission: "brand:view" },
      { path: "/vehicles/models", title: "车型管理", permission: "brand:view" },
      { path: "/vehicles/categories", title: "车辆分类", permission: "vehicle:view" },
      { path: "/vehicles/tags", title: "车辆标签", permission: "vehicle:view" },
    ],
  },
  {
    path: "/homepage",
    title: "首页管理",
    permission: "homepage:view",
    children: [
      {
        path: "/homepage/banners",
        title: "首页轮播图",
        permission: "banner:view",
      },
      {
        path: "/homepage/sections",
        title: "首页模块",
        permission: "homepage:view",
      },
      {
        path: "/homepage/recommendations",
        title: "推荐车辆",
        permission: "homepage:view",
      },
      {
        path: "/homepage/brands",
        title: "品牌展示",
        permission: "homepage:view",
      },
      {
        path: "/homepage/features",
        title: "优势图标",
        permission: "homepage:view",
      },
      {
        path: "/homepage/video",
        title: "首页视频",
        permission: "homepage:view",
      },
      {
        path: "/homepage/about",
        title: "公司简介",
        permission: "homepage:view",
      },
      { path: "/homepage/cta", title: "行动按钮", permission: "homepage:view" },
    ],
  },
  {
    path: "/content",
    title: "网站内容",
    permission: "content:view",
    children: [
      { path: "/content/pages", title: "页面管理", permission: "content:view" },
      {
        path: "/content/navigation",
        title: "导航菜单",
        permission: "content:view",
      },
      {
        path: "/content/footer",
        title: "页脚管理",
        permission: "settings:view",
      },
      {
        path: "/content/contact",
        title: "联系方式",
        permission: "settings:view",
      },
      {
        path: "/content/social",
        title: "社交媒体",
        permission: "settings:view",
      },
      { path: "/content/seo", title: "SEO 设置", permission: "settings:view" },
    ],
  },
  {
    path: "/media",
    title: "素材管理",
    permission: "media:view",
    children: [
      { path: "/media/images", title: "图片库", permission: "media:view" },
      { path: "/media/videos", title: "视频库", permission: "media:view" },
      { path: "/media/folders", title: "文件夹管理", permission: "media:view" },
      { path: "/media/uploads", title: "上传记录", permission: "media:view" },
    ],
  },
  {
    path: "/inquiries",
    title: "客户管理",
    permission: "inquiry:list",
    children: [
      {
        path: "/inquiries/records",
        title: "询价记录",
        permission: "inquiry:list",
      },
      {
        path: "/inquiries/messages",
        title: "联系留言",
        permission: "inquiry:list",
      },
      {
        path: "/inquiries/whatsapp",
        title: "WhatsApp 咨询",
        permission: "inquiry:list",
      },
      {
        path: "/inquiries/notes",
        title: "客户备注",
        permission: "inquiry:list",
      },
      {
        path: "/inquiries/export",
        title: "数据导出",
        permission: "inquiry:export",
      },
    ],
  },
  {
    path: "/permissions",
    title: "权限管理",
    permission: "user:view",
    children: [
      { path: "/permissions/users", title: "管理员", permission: "user:view" },
      {
        path: "/permissions/roles",
        title: "角色管理",
        permission: "role:view",
      },
      {
        path: "/permissions/list",
        title: "权限列表",
        permission: "permission:view",
      },
    ],
  },
  {
    path: "/system",
    title: "系统管理",
    permission: "settings:view",
    children: [
      {
        path: "/system/settings",
        title: "网站设置",
        permission: "settings:view",
      },
      {
        path: "/system/translation-model",
        title: "API 模型配置",
        permission: "settings:view",
      },
      {
        path: "/system/storage",
        title: "文件存储",
        permission: "storage-settings:view",
      },
      {
        path: "/system/mail",
        title: "邮件设置",
        permission: "mail-settings:view",
      },
      { path: "/system/audit", title: "操作日志", permission: "audit:view" },
      {
        path: "/system/logs",
        title: "系统日志",
        permission: "system-log:view",
      },
      {
        path: "/system/info",
        title: "系统信息",
        permission: "system-info:view",
      },
    ],
  },
];

function filterMenu(items: MenuItem[], allowed: Set<string>): MenuItem[] {
  return items.flatMap((item) => {
    const children = item.children
      ? filterMenu(item.children, allowed)
      : undefined;
    if (item.permission && !allowed.has(item.permission) && !children?.length)
      return [];
    return [{ ...item, ...(children ? { children } : {}) }];
  });
}

export function menuForPermissions(permissions: string[]): MenuItem[] {
  return filterMenu(ADMIN_MENU, new Set(permissions));
}
