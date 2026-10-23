import type { MediaAsset } from "@/types/business";

import { nextTick, reactive, ref, watch } from "vue";

import {
  getHomepageContent,
  publishHomepageContent,
  updateHomepageContent
} from "@/api/content";
import { showActionError } from "@/utils/action-feedback";
import { hasPerms } from "@/utils/auth";
import { ElMessage, ElMessageBox } from "element-plus";

export type LocalizedText = { zh: string; en: string; ru: string };
export type HomepageHeroItem = {
  imageMediaId: null | string;
  mobileMediaId: null | string;
  title: LocalizedText;
  enabled: boolean;
};
export type HomepageAboutSection = {
  enabled: boolean;
  title: LocalizedText;
  body: LocalizedText;
  button: { label: LocalizedText; href: string };
  videoMediaId: null | string;
  posterMediaId: null | string;
};
type CustomModuleMediaType = "IMAGE" | "NONE" | "VIDEO";
type CustomModulePlacement =
  | "ABOUT_AFTER_INTRO"
  | "AFTER_VIDEOS"
  | "BEFORE_ABOUT"
  | "HOME_AFTER_FEATURES";
type CustomModuleDisplayScope = "ABOUT" | "BOTH" | "HOME";
export type HomepageCustomModule = {
  id: string;
  enabled: boolean;
  placement: CustomModulePlacement;
  displayScope: CustomModuleDisplayScope;
  title: LocalizedText;
  body: LocalizedText;
  mediaType: CustomModuleMediaType;
  imageMediaId: null | string;
  videoMediaId: null | string;
  posterMediaId: null | string;
  stageImages?: Array<{ imageMediaId: null | string }>;
  button: { label: LocalizedText; href: string };
};
type ItemKind =
  | "custom"
  | "hero"
  | "locations"
  | "quickNav"
  | "staff"
  | "transport"
  | "videos";
type ModuleKind = "about" | ItemKind;

const moduleLabels: Record<ModuleKind, string> = {
  hero: "顶部轮播",
  about: "关于我们",
  transport: "运输与交付",
  staff: "员工风采",
  videos: "视频",
  quickNav: "快捷导航",
  locations: "办公室与停车场",
  custom: "自定义模块"
};

function localizedText(): LocalizedText {
  return { zh: "", en: "", ru: "" };
}

function createCustomModule(): HomepageCustomModule {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: true,
    placement: "AFTER_VIDEOS",
    displayScope: "BOTH",
    title: localizedText(),
    body: localizedText(),
    mediaType: "NONE",
    imageMediaId: null,
    videoMediaId: null,
    posterMediaId: null,
    button: { label: localizedText(), href: "" }
  };
}

function createInitialContent() {
  return {
    managed: true,
    schemaVersion: 5,
    companyOverviewSeeded: false,
    companyOverviewLayoutVersion: 0,
    companyOverviewBodyFormatVersion: 0,
    heroEnabled: true,
    hero: [] as HomepageHeroItem[],
    about: {
      enabled: true,
      title: localizedText(),
      body: localizedText(),
      button: { label: localizedText(), href: "#about" },
      videoMediaId: null as null | string,
      posterMediaId: null as null | string
    } as HomepageAboutSection,
    transport: {
      enabled: true,
      title: localizedText(),
      items: [] as Array<{
        imageMediaId: null | string;
        title: LocalizedText;
        description: LocalizedText;
      }>
    },
    staff: {
      enabled: true,
      title: localizedText(),
      items: [] as Array<{
        imageMediaId: null | string;
        name: LocalizedText;
        role: LocalizedText;
        description: LocalizedText;
      }>
    },
    videos: {
      enabled: true,
      title: localizedText(),
      items: [] as Array<{
        videoMediaId: null | string;
        posterMediaId: null | string;
        title: LocalizedText;
      }>
    },
    quickNav: {
      enabled: true,
      title: localizedText(),
      items: [] as Array<{
        label: LocalizedText;
        href: string;
        enabled: boolean;
      }>
    },
    locations: {
      enabled: true,
      title: localizedText(),
      items: [] as Array<{
        type: "OFFICE" | "PARKING";
        name: LocalizedText;
        address: LocalizedText;
        mapUrl: string;
        enabled: boolean;
      }>
    },
    customModules: [] as HomepageCustomModule[]
  };
}

export function useHomepageContentEditor() {
  const loading = ref(false);
  const saving = ref(false);
  const loadError = ref("");
  const dirty = ref(false);
  const tracking = ref(false);
  const active = ref("hero");
  const media = ref<Record<string, MediaAsset>>({});
  const canManage = hasPerms("content:manage");
  const content = reactive(createInitialContent());

  watch(
    content,
    () => {
      if (tracking.value) dirty.value = true;
    },
    { deep: true }
  );

  function replace(data: Record<string, unknown>): void {
    Object.assign(content, createInitialContent(), data);
  }

  function add(kind: ItemKind): void {
    switch (kind) {
      case "hero":
        content.heroEnabled = true;
        content.hero.push({
          imageMediaId: null,
          mobileMediaId: null,
          title: localizedText(),
          enabled: true
        });
        break;
      case "transport":
        content.transport.enabled = true;
        content.transport.items.push({
          imageMediaId: null,
          title: localizedText(),
          description: localizedText()
        });
        break;
      case "staff":
        content.staff.enabled = true;
        content.staff.items.push({
          imageMediaId: null,
          name: localizedText(),
          role: localizedText(),
          description: localizedText()
        });
        break;
      case "videos":
        content.videos.enabled = true;
        content.videos.items.push({
          videoMediaId: null,
          posterMediaId: null,
          title: localizedText()
        });
        break;
      case "quickNav":
        content.quickNav.enabled = true;
        content.quickNav.items.push({
          label: localizedText(),
          href: "#about",
          enabled: true
        });
        break;
      case "locations":
        content.locations.enabled = true;
        content.locations.items.push({
          type: "OFFICE",
          name: localizedText(),
          address: localizedText(),
          mapUrl: "",
          enabled: true
        });
        break;
      case "custom":
        content.customModules.push(createCustomModule());
        break;
    }
  }

  async function clearModule(kind: ModuleKind): Promise<void> {
    const custom = kind === "custom";
    try {
      await ElMessageBox.confirm(
        custom
          ? "确认清空全部自定义模块吗？素材文件仍保留在素材库中。"
          : `确认清空并隐藏“${moduleLabels[kind]}”吗？素材文件仍保留在素材库中。`,
        "删除首页模块",
        {
          type: "warning",
          confirmButtonText: custom ? "清空全部" : "清空并隐藏",
          cancelButtonText: "取消"
        }
      );
    } catch {
      return;
    }

    const defaults = createInitialContent();
    switch (kind) {
      case "custom":
        content.customModules = [];
        break;
      case "hero":
        content.hero = [];
        content.heroEnabled = false;
        break;
      case "about":
        Object.assign(content.about, defaults.about, { enabled: false });
        break;
      case "transport":
        Object.assign(content.transport, defaults.transport, {
          enabled: false
        });
        break;
      case "staff":
        Object.assign(content.staff, defaults.staff, { enabled: false });
        break;
      case "videos":
        Object.assign(content.videos, defaults.videos, { enabled: false });
        break;
      case "quickNav":
        Object.assign(content.quickNav, defaults.quickNav, { enabled: false });
        break;
      case "locations":
        Object.assign(content.locations, defaults.locations, {
          enabled: false
        });
        break;
    }
  }

  async function remove<T>(
    items: T[],
    index: number,
    label: string
  ): Promise<void> {
    try {
      await ElMessageBox.confirm(
        `确认删除此${label}吗？素材文件会保留在素材库中。`,
        "删除内容",
        { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
      );
      items.splice(index, 1);
    } catch {
      // The user cancelled the confirmation dialog.
    }
  }

  function move<T>(items: T[], index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const [item] = items.splice(index, 1);
    items.splice(target, 0, item!);
  }

  async function save(publish = false): Promise<void> {
    if (!canManage) return;
    saving.value = true;
    try {
      content.managed = true;
      await updateHomepageContent(JSON.parse(JSON.stringify(content)));
      if (publish) await publishHomepageContent();
      ElMessage.success(publish ? "已发布并同步官网" : "草稿已保存");
      dirty.value = false;
    } catch (error) {
    showActionError(error);
  } finally {
    saving.value = false;
    }
  }

  async function load(): Promise<void> {
    loading.value = true;
    loadError.value = "";
    tracking.value = false;
    try {
      const page = await getHomepageContent();
      replace((page.content || {}) as Record<string, unknown>);
      media.value = page.media || {};
      await nextTick();
      dirty.value = false;
      tracking.value = true;
    } catch (error) {
      loadError.value =
        error instanceof Error ? error.message : "加载失败，请重试。";
    } finally {
      loading.value = false;
    }
  }

  function asset(id: null | string): MediaAsset | null {
    return id ? media.value[id] || null : null;
  }

  function rememberAssets(items: MediaAsset[]): void {
    for (const item of items) media.value[item.id] = item;
  }

  void load();

  return {
    active,
    add,
    asset,
    canManage,
    clearModule,
    content,
    dirty,
    load,
    loadError,
    loading,
    media,
    move,
    rememberAssets,
    remove,
    save,
    saving
  };
}
