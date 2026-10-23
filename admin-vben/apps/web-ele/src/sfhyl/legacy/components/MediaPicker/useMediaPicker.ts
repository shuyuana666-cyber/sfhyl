import { computed, ref } from "vue";
import type { UploadRequestOptions } from "element-plus";
import { ElMessage } from "element-plus";
import {
  getFolders,
  getMedia,
  uploadMedia,
  type MediaFolder
} from "@/api/media";
import type { MediaAsset } from "@/types/business";
import { resolveMediaUrl } from "@/utils/media";

export type MimeGroup = "image" | "video" | "all";

export interface MediaPickerProps {
  modelValue: string | string[] | null;
  multiple?: boolean;
  mimeGroup?: MimeGroup;
  asset?: MediaAsset | null;
  disabled?: boolean;
  allowUpload?: boolean;
}

interface MediaPickerStateProps extends MediaPickerProps {
  multiple: boolean;
  mimeGroup: MimeGroup;
  disabled: boolean;
  allowUpload: boolean;
}

type MediaPickerEmit = {
  (event: "update:modelValue", value: string | string[] | null): void;
  (event: "select", items: MediaAsset[]): void;
};

export function useMediaPicker(
  props: Readonly<MediaPickerStateProps>,
  emit: MediaPickerEmit
) {
  const open = ref(false);
  const loading = ref(false);
  const uploading = ref(false);
  const folders = ref<MediaFolder[]>([]);
  const items = ref<MediaAsset[]>([]);
  const keyword = ref("");
  const selected = ref<string[]>([]);
  const knownAssets = ref<Record<string, MediaAsset>>({});
  const currentFolderId = ref<string | null>(null);
  const showingUnfiled = ref(false);
  const page = ref(1);
  const pageSize = 24;
  const total = ref(0);
  let mediaRequestVersion = 0;

  const selectionText = computed(() => {
    const count = Array.isArray(props.modelValue)
      ? props.modelValue.length
      : props.modelValue
        ? 1
        : 0;
    return count ? `已选择 ${count} 项` : "选择素材";
  });
  const mediaLabel = computed(() => {
    if (props.mimeGroup === "video") return "视频";
    if (props.mimeGroup === "image") return "图片";
    return "素材";
  });
  const actionLabel = computed(() => {
    const hasSelection = Array.isArray(props.modelValue)
      ? props.modelValue.length > 0
      : Boolean(props.modelValue);
    return hasSelection ? `替换${mediaLabel.value}` : `选择${mediaLabel.value}`;
  });
  const selectedAssetName = computed(
    () => props.asset?.originalName || props.asset?.filename || "已选素材"
  );
  const imagePreviewUrl = computed(() =>
    props.asset?.mimeType.startsWith("image/")
      ? resolveMediaUrl(
          props.asset.webpUrl || props.asset.thumbnailUrl || props.asset.url
        )
      : ""
  );
  const currentFolder = computed(() =>
    currentFolderId.value
      ? folders.value.find(folder => folder.id === currentFolderId.value) ||
        null
      : null
  );
  const childFolders = computed(() =>
    folders.value.filter(
      folder => (folder.parentId || null) === currentFolderId.value
    )
  );
  const breadcrumbs = computed(() => {
    const result: MediaFolder[] = [];
    let folder = currentFolder.value;
    while (folder) {
      result.unshift(folder);
      folder = folder.parentId
        ? folders.value.find(item => item.id === folder?.parentId) || null
        : null;
    }
    return result;
  });
  const folderView = computed(
    () => !currentFolderId.value && !showingUnfiled.value
  );
  const canUpload = computed(
    () => props.allowUpload && !folderView.value && !props.disabled
  );
  const uploadAccept = computed(() => {
    if (props.mimeGroup === "image") return "image/*";
    if (props.mimeGroup === "video") return "video/*";
    return "image/*,video/*";
  });

  function uploadError(
    message: string
  ): Parameters<NonNullable<UploadRequestOptions["onError"]>>[0] {
    return Object.assign(new Error(message), {
      status: 0,
      method: "POST",
      url: ""
    }) as Parameters<NonNullable<UploadRequestOptions["onError"]>>[0];
  }

  function rememberAssets(assets: MediaAsset[]): void {
    for (const asset of assets) knownAssets.value[asset.id] = asset;
  }

  async function loadFolders(): Promise<void> {
    folders.value = await getFolders();
  }

  async function loadMedia(): Promise<void> {
    const requestVersion = ++mediaRequestVersion;
    if (folderView.value) {
      items.value = [];
      total.value = 0;
      loading.value = false;
      return;
    }

    loading.value = true;
    try {
      const result = await getMedia({
        page: page.value,
        pageSize,
        folderId: currentFolderId.value || undefined,
        unfiled: showingUnfiled.value || undefined,
        keyword: keyword.value.trim() || undefined,
        mimeGroup: props.mimeGroup === "all" ? undefined : props.mimeGroup
      });
      if (requestVersion !== mediaRequestVersion) return;
      items.value = result.items;
      total.value = result.pagination.total;
      rememberAssets(result.items);
    } finally {
      if (requestVersion === mediaRequestVersion) loading.value = false;
    }
  }

  async function showPicker(): Promise<void> {
    if (props.disabled) return;
    selected.value = Array.isArray(props.modelValue)
      ? [...props.modelValue]
      : props.modelValue
        ? [props.modelValue]
        : [];
    knownAssets.value = {};
    if (props.asset) rememberAssets([props.asset]);
    currentFolderId.value = null;
    showingUnfiled.value = false;
    keyword.value = "";
    page.value = 1;
    items.value = [];
    total.value = 0;
    open.value = true;
    loading.value = true;
    try {
      await loadFolders();
    } finally {
      loading.value = false;
    }
  }

  function enterFolder(id: string): void {
    currentFolderId.value = id;
    showingUnfiled.value = false;
    keyword.value = "";
    page.value = 1;
    void loadMedia();
  }

  function showUnfiled(): void {
    currentFolderId.value = null;
    showingUnfiled.value = true;
    keyword.value = "";
    page.value = 1;
    void loadMedia();
  }

  function goToFolder(id: string | null): void {
    currentFolderId.value = id;
    showingUnfiled.value = false;
    keyword.value = "";
    page.value = 1;
    void loadMedia();
  }

  function search(): void {
    if (folderView.value) return;
    page.value = 1;
    void loadMedia();
  }

  function toggle(item: MediaAsset): void {
    rememberAssets([item]);
    if (!props.multiple) {
      selected.value = [item.id];
      return;
    }
    selected.value = selected.value.includes(item.id)
      ? selected.value.filter(value => value !== item.id)
      : [...selected.value, item.id];
  }

  function confirm(): void {
    const selectedItems = selected.value
      .map(id => knownAssets.value[id])
      .filter((item): item is MediaAsset => Boolean(item));
    emit(
      "update:modelValue",
      props.multiple ? selected.value : selected.value[0] || null
    );
    emit("select", selectedItems);
    open.value = false;
  }

  function clear(): void {
    if (props.disabled) return;
    emit("update:modelValue", props.multiple ? [] : null);
  }

  function accepts(file: File): boolean {
    if (props.mimeGroup === "all")
      return file.type.startsWith("image/") || file.type.startsWith("video/");
    return file.type.startsWith(`${props.mimeGroup}/`);
  }

  async function upload(options: UploadRequestOptions): Promise<void> {
    if (folderView.value) {
      ElMessage.warning("请先进入文件夹或未分类素材后再上传");
      options.onError?.(uploadError("Select a folder or unfiled media."));
      return;
    }
    if (!accepts(options.file)) {
      ElMessage.error(`只能上传${mediaLabel.value}`);
      options.onError?.(uploadError("Unsupported media type."));
      return;
    }

    uploading.value = true;
    try {
      const data = new FormData();
      data.append("file", options.file);
      if (currentFolderId.value) data.append("folderId", currentFolderId.value);
      const asset = await uploadMedia(data);
      rememberAssets([asset]);
      selected.value = props.multiple
        ? [...new Set([...selected.value, asset.id])]
        : [asset.id];
      page.value = 1;
      await loadMedia();
      options.onSuccess?.(asset);
      ElMessage.success("素材已上传并选中");
    } catch (error) {
      options.onError?.(
        error instanceof Error
          ? uploadError(error.message)
          : uploadError("Upload failed.")
      );
    } finally {
      uploading.value = false;
    }
  }

  return {
    actionLabel,
    breadcrumbs,
    canUpload,
    childFolders,
    clear,
    confirm,
    currentFolderId,
    enterFolder,
    folderView,
    goToFolder,
    imagePreviewUrl,
    items,
    keyword,
    loadMedia,
    loading,
    mediaLabel,
    open,
    page,
    pageSize,
    selected,
    selectedAssetName,
    selectionText,
    showPicker,
    showUnfiled,
    showingUnfiled,
    search,
    toggle,
    total,
    upload,
    uploadAccept,
    uploading
  };
}
