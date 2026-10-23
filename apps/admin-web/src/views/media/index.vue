<script setup lang="ts">
import { computed, onMounted, reactive, ref, toRef, watch } from "vue";
import { useRoute } from "vue-router";
import type { UploadProgressEvent, UploadRequestOptions } from "element-plus";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  batchMedia,
  getFolders,
  getMedia,
  permanentlyDeleteMedia,
  restoreMedia,
  uploadMedia,
  type MediaFolder
} from "@/api/media";
import type { MediaAsset } from "@/types/business";
import { hasPerms } from "@/utils/auth";
import { formatBytes } from "@/utils/format-bytes";
import { resolveMediaUrl } from "@/utils/media";
import RequestError from "@/components/RequestError/index.vue";
import MediaAssetCard from "./MediaAssetCard.vue";
import { getRequestErrorMessage } from "@/utils/http/error-message";
import { useMediaFolders } from "./useMediaFolders";
import MediaAssetEditDialog from "./MediaAssetEditDialog.vue";

defineOptions({ name: "MediaLibrary" });
const route = useRoute();
const loading = ref(false);
const loadError = ref("");
const activeUploads = ref(0);
const uploading = computed(() => activeUploads.value > 0);
const items = ref<MediaAsset[]>([]);
const folders = ref<MediaFolder[]>([]);
const total = ref(0);
const editOpen = ref(false);
const editMode = ref<"edit" | "move">("edit");
const previewOpen = ref(false);
const saving = ref(false);
const editingAsset = ref<MediaAsset | null>(null);
const previewAsset = ref<MediaAsset | null>(null);
const selectedIds = ref<string[]>([]);
const batchFolderId = ref("");
const query = reactive({
  page: 1,
  pageSize: 24,
  keyword: "",
  folderId: "",
  mimeGroup: "",
  createdFrom: "",
  createdTo: "",
  deleted: "false"
});
const pageTitle = computed(() => route.meta.title || "素材管理");
async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [result, folderRows] = await Promise.all([
      getMedia(
        Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""))
      ),
      getFolders()
    ]);
    items.value = result.items;
    selectedIds.value = [];
    total.value = result.pagination.total;
    folders.value = folderRows;
  } catch (error) {
    items.value = [];
    total.value = 0;
    loadError.value = getRequestErrorMessage(error);
  } finally {
    loading.value = false;
  }
}
const {
  breadcrumbs,
  childFolders,
  currentFolder,
  createFolderDialog,
  editFolderDialog,
  editingFolderId,
  folderForm,
  folderOpen,
  removeFolder,
  saveFolder
} = useMediaFolders({
  folders,
  folderId: toRef(query, "folderId"),
  deleted: toRef(query, "deleted"),
  saving,
  reload: load
});
async function upload(options: UploadRequestOptions) {
  activeUploads.value += 1;
  try {
    const data = new FormData();
    data.append("file", options.file);
    if (query.folderId) data.append("folderId", query.folderId);
    const asset = await uploadMedia(data, percentage => {
      const event = new ProgressEvent("upload", {
        lengthComputable: true,
        loaded: percentage,
        total: 100
      }) as UploadProgressEvent;
      event.percent = percentage;
      options.onProgress(event);
    });
    options.onSuccess(asset);
    const size = formatBytes(Number(asset.sizeBytes));
    const converted =
      options.file.type.startsWith("image/") && asset.mimeType === "image/webp";
    ElMessage.success(
      converted
        ? `上传完成，已压缩为 WebP（${asset.width || "-"} × ${asset.height || "-"}，${size}）`
        : `上传完成（${size}）`
    );
    await load();
  } catch (error) {
    options.onError(error as never);
  } finally {
    activeUploads.value -= 1;
  }
}
function edit(item: MediaAsset, mode: "edit" | "move" = "edit") {
  editMode.value = mode;
  editingAsset.value = item;
  editOpen.value = true;
}
function openPreview(item: MediaAsset): void {
  if (
    !item.mimeType.startsWith("image/") &&
    !item.mimeType.startsWith("video/")
  )
    return;
  previewAsset.value = item;
  previewOpen.value = true;
}
function clearPreview(): void {
  previewAsset.value = null;
}

function toggleSelection(id: string, checked: boolean): void {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter(item => item !== id);
}
function clearSelection(): void {
  selectedIds.value = [];
}
async function batchMove(): Promise<void> {
  if (!selectedIds.value.length) return;
  await batchMedia({
    ids: selectedIds.value,
    action: "MOVE",
    folderId: batchFolderId.value || null
  });
  ElMessage.success(`已移动 ${selectedIds.value.length} 个素材`);
  batchFolderId.value = "";
  await load();
}
async function batchDelete(): Promise<void> {
  if (!selectedIds.value.length) return;
  await ElMessageBox.confirm(
    `确认将选中的 ${selectedIds.value.length} 个素材彻底删除？原图和缩略图将一并删除。`,
    "批量彻底删除",
    { type: "warning" }
  );
  await batchMedia({ ids: selectedIds.value, action: "DELETE" });
  ElMessage.success("素材已彻底删除");
  await load();
}

async function restore(item: MediaAsset) {
  await restoreMedia(item.id);
  ElMessage.success("素材已恢复");
  await load();
}
async function permanent(item: MediaAsset) {
  await ElMessageBox.confirm(
    `确认彻底删除“${item.originalName || item.filename}”？原图、缩略图及素材记录将永久删除。正在使用的素材需先替换引用。`,
    "永久删除",
    { type: "warning", confirmButtonText: "永久删除" }
  );
  await permanentlyDeleteMedia(item.id);
  ElMessage.success("素材已彻底删除");
  await load();
}
async function copy(url: string) {
  await navigator.clipboard.writeText(resolveMediaUrl(url));
  ElMessage.success("URL 已复制");
}
function applyRoutePreset(): void {
  Object.assign(query, {
    page: 1,
    pageSize: 24,
    keyword: "",
    folderId: "",
    mimeGroup: "",
    createdFrom: "",
    createdTo: "",
    deleted: "false"
  });
  Object.assign(query, route.meta.mediaPreset || {});
}
function reset(): void {
  applyRoutePreset();
  void load();
}
function openFolder(id: string): void {
  query.folderId = id;
  query.page = 1;
  void load();
}
watch(
  () => route.name,
  () => {
    applyRoutePreset();
    void load();
  }
);
onMounted(() => {
  applyRoutePreset();
  void load();
});
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>{{ pageTitle }}</h1>
        <p>图片、视频和普通文件的统一素材库</p>
      </div>
      <div class="heading-actions">
        <el-button
          v-if="
            currentFolder &&
            query.deleted === 'false' &&
            hasPerms('media:delete')
          "
          type="danger"
          plain
          @click="removeFolder(currentFolder)"
        >
          <IconifyIconOnline icon="ri:delete-bin-line" />删除当前文件夹
        </el-button>
        <el-button v-if="hasPerms('media:upload')" @click="createFolderDialog"
          ><IconifyIconOnline icon="ri:folder-add-line" />新建文件夹</el-button
        ><el-upload
          v-if="hasPerms('media:upload')"
          multiple
          class="media-uploader"
          :show-file-list="true"
          :http-request="upload"
          ><el-button type="primary" :loading="uploading"
            ><IconifyIconOnline
              icon="ri:upload-cloud-2-line"
            />上传素材</el-button
          ></el-upload
        >
      </div>
    </div>
    <nav
      v-if="query.deleted === 'false'"
      class="folder-path"
      aria-label="文件夹路径"
    >
      <button
        type="button"
        :class="{ active: !query.folderId }"
        @click="openFolder('')"
      >
        <IconifyIconOnline icon="ri:folder-open-line" />全部素材
      </button>
      <template v-for="folder in breadcrumbs" :key="folder.id">
        <span aria-hidden="true">/</span>
        <button
          type="button"
          :class="{ active: query.folderId === folder.id }"
          @click="openFolder(folder.id)"
        >
          {{ folder.name }}
        </button>
      </template>
    </nav>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="搜索文件名"
        style="width: 240px"
        @keyup.enter="
          query.page = 1;
          load();
        "
      /><el-select
        v-model="query.mimeGroup"
        clearable
        placeholder="文件类型"
        style="width: 130px"
        ><el-option label="图片" value="image" /><el-option
          label="视频"
          value="video" /><el-option
          label="PDF"
          value="application" /></el-select
      ><el-date-picker
        v-model="query.createdFrom"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="上传开始"
        style="width: 150px"
      /><el-date-picker
        v-model="query.createdTo"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="上传结束"
        style="width: 150px"
      /><el-segmented
        v-model="query.deleted"
        :options="[
          { label: '素材库', value: 'false' },
          { label: '回收站', value: 'true' }
        ]"
        @change="
          query.page = 1;
          load();
        "
      /><el-button
        type="primary"
        @click="
          query.page = 1;
          load();
        "
        >查询</el-button
      ><el-button @click="reset">重置</el-button>
    </div>
    <div
      v-if="selectedIds.length && query.deleted === 'false'"
      class="media-selection-toolbar"
    >
      <strong>已选择 {{ selectedIds.length }} 个素材</strong>
      <el-select
        v-model="batchFolderId"
        clearable
        placeholder="移动到文件夹"
        style="width: 220px"
      >
        <el-option label="根目录" value="" />
        <el-option
          v-for="folder in folders"
          :key="folder.id"
          :label="folder.name"
          :value="folder.id"
        />
      </el-select>
      <el-button
        v-if="hasPerms('media:upload')"
        type="primary"
        @click="batchMove"
      >
        <IconifyIconOnline icon="ri:folder-transfer-line" />移动
      </el-button>
      <el-button
        v-if="hasPerms('media:delete')"
        type="danger"
        plain
        @click="batchDelete"
      >
        <IconifyIconOnline icon="ri:delete-bin-line" />彻底删除
      </el-button>
      <el-button text @click="clearSelection">取消选择</el-button>
    </div>
    <RequestError v-if="loadError" :message="loadError" @retry="load" />
    <div v-loading="loading" class="media-grid media-library-grid">
      <article
        v-for="folder in childFolders"
        :key="folder.id"
        class="media-folder-card"
        :data-folder-id="folder.id"
      >
        <button
          type="button"
          class="media-folder-card__open"
          @click="openFolder(folder.id)"
        >
          <IconifyIconOnline icon="ri:folder-3-line" />
          <strong :title="folder.name">{{ folder.name }}</strong>
          <span>
            {{ folder._count?.assets || 0 }} 项素材 ·
            {{ folder._count?.children || 0 }} 个子文件夹
          </span>
        </button>
        <div
          v-if="hasPerms('media:upload') || hasPerms('media:delete')"
          class="media-folder-card__actions"
        >
          <el-button
            v-if="hasPerms('media:upload')"
            text
            :aria-label="`编辑文件夹 ${folder.name}`"
            @click.stop="editFolderDialog(folder)"
          >
            <IconifyIconOnline icon="ri:edit-line" />编辑
          </el-button>
          <el-button
            v-if="hasPerms('media:delete')"
            text
            type="danger"
            :aria-label="`删除文件夹 ${folder.name}`"
            @click.stop="removeFolder(folder)"
          >
            <IconifyIconOnline icon="ri:delete-bin-line" />删除
          </el-button>
        </div>
      </article>
      <MediaAssetCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        :deleted="query.deleted === 'true'"
        :selected="selectedIds.includes(item.id)"
        @selection="toggleSelection(item.id, $event)"
        @preview="openPreview"
        @edit="edit"
        @copy="copy"
        @move="item => edit(item, 'move')"
        @restore="restore"
        @permanent="permanent"
      />
      <el-empty
        v-if="!loading && !items.length && !childFolders.length"
        description="暂无素材"
      />
    </div>
    <div class="pagination-row">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @change="load"
      />
    </div>
    <MediaAssetEditDialog
      v-model="editOpen"
      :asset="editingAsset"
      :mode="editMode"
      :folders="folders"
      @saved="load"
    />
    <el-dialog
      v-model="folderOpen"
      :title="editingFolderId ? '编辑文件夹' : '新建文件夹'"
      width="min(520px,94vw)"
      ><el-form label-position="top"
        ><el-form-item label="名称" required
          ><el-input v-model="folderForm.name" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="folderOpen = false">取消</el-button
        ><el-button
          v-if="hasPerms('media:upload')"
          type="primary"
          :loading="saving"
          @click="saveFolder"
          >保存</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="previewOpen"
      title="预览素材"
      width="min(1080px,94vw)"
      top="6vh"
      destroy-on-close
      class="media-preview-dialog"
      @closed="clearPreview"
    >
      <div v-if="previewAsset" class="media-preview-content">
        <img
          v-if="previewAsset.mimeType.startsWith('image/')"
          :src="resolveMediaUrl(previewAsset.webpUrl || previewAsset.url)"
          :alt="
            previewAsset.altZh ||
            previewAsset.originalName ||
            previewAsset.filename
          "
          class="media-preview-content__media"
        />
        <video
          v-else-if="previewAsset.mimeType.startsWith('video/')"
          :src="resolveMediaUrl(previewAsset.url)"
          :poster="resolveMediaUrl(previewAsset.thumbnailUrl) || undefined"
          class="media-preview-content__media"
          controls
          playsinline
          preload="metadata"
        />
        <p class="media-preview-content__name">
          {{ previewAsset.originalName || previewAsset.filename }}
        </p>
      </div>
    </el-dialog>
  </div>
</template>
<style scoped>
.heading-actions {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.media-uploader {
  max-width: 320px;
}

.folder-path {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 44px;
  border-block: 1px solid var(--ops-line);
}

.folder-path button {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 5px 2px;
  color: var(--ops-muted);
  background: transparent;
  border: 0;
}

.folder-path button.active {
  font-weight: 600;
  color: var(--ops-accent);
}

.folder-path span {
  font-size: 11px;
}

.media-library-grid {
  min-height: 240px;
  margin-top: 14px;
}

.media-selection-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  margin-top: 12px;
  color: var(--ops-text);
  background: #fff8f5;
  border: 1px solid #f3d8cf;
  border-radius: 6px;
}

.media-selection-toolbar strong {
  margin-right: auto;
  font-size: 13px;
}

.media-folder-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--ops-line);
  border-radius: 6px;
}

.media-folder-card:hover {
  border-color: var(--ops-accent);
  box-shadow: 0 2px 8px rgb(199 44 53 / 12%);
}

.media-folder-card__open {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 3px 10px;
  align-items: center;
  width: 100%;
  min-height: 164px;
  padding: 16px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.media-folder-card__open :deep(svg) {
  grid-row: span 2;
  font-size: 31px;
  color: var(--ops-accent);
}

.media-folder-card__open strong,
.media-folder-card__open span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-folder-card__open span {
  font-size: 11px;
  color: var(--ops-muted);
}

.media-folder-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding: 4px 8px;
  border-top: 1px solid var(--ops-line);
}

:deep(.media-preview-dialog .el-dialog__body) {
  padding-top: 8px;
}

.media-preview-content {
  display: grid;
  gap: 10px;
  justify-items: center;
}

.media-preview-content__media {
  display: block;
  width: 100%;
  max-height: min(72vh, 720px);
  object-fit: contain;
  background: #121820;
  border-radius: 4px;
}

.media-preview-content__name {
  width: 100%;
  margin: 0;
  font-size: 12px;
  color: var(--ops-muted);
  overflow-wrap: anywhere;
}

@media (width <= 620px) {
  .heading-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .media-library-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .media-selection-toolbar {
    align-items: stretch;
  }

  .media-selection-toolbar strong {
    width: 100%;
  }

  .media-selection-toolbar .el-select,
  .media-selection-toolbar .el-button {
    flex: 1 1 auto;
  }
}
</style>
