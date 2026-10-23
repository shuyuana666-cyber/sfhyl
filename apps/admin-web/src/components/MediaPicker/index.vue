<script setup lang="ts">
import { useMediaPicker, type MediaPickerProps } from "./useMediaPicker";
import VideoThumbnail from "@/components/VideoThumbnail/index.vue";
import type { MediaAsset } from "@/types/business";
import { resolveMediaUrl } from "@/utils/media";

const props = withDefaults(defineProps<MediaPickerProps>(), {
  multiple: false,
  mimeGroup: "image",
  disabled: false,
  allowUpload: false
});
const emit = defineEmits<{
  "update:modelValue": [value: string | string[] | null];
  select: [items: MediaAsset[]];
}>();

const {
  actionLabel,
  breadcrumbs,
  canUpload,
  childFolders,
  clear,
  confirm,
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
} = useMediaPicker(props, emit);
</script>

<template>
  <div class="media-picker">
    <slot name="trigger" :open="showPicker">
      <div v-if="asset && !multiple" class="selected-media">
        <img
          v-if="imagePreviewUrl"
          :src="imagePreviewUrl"
          :alt="selectedAssetName"
        />
        <VideoThumbnail
          v-else-if="asset.mimeType.startsWith('video/')"
          class="selected-media-video"
          :src="asset.url"
          :poster="asset.thumbnailUrl"
          :label="selectedAssetName"
        />
        <div v-else class="selected-media-file">
          <IconifyIconOnline icon="ri:movie-2-line" />
        </div>
        <span>{{ selectedAssetName }}</span>
      </div>
      <el-button :disabled="disabled" @click="showPicker">
        <IconifyIconOnline icon="ri:image-add-line" />
        <span>{{ multiple ? selectionText : actionLabel }}</span>
      </el-button>
      <el-button
        v-if="
          modelValue && (Array.isArray(modelValue) ? modelValue.length : true)
        "
        text
        type="danger"
        :disabled="disabled"
        @click="clear"
        >清除素材</el-button
      >
    </slot>

    <el-dialog
      v-model="open"
      title="选择素材"
      width="min(960px, 94vw)"
      append-to-body
    >
      <div class="picker-path">
        <el-button text @click="goToFolder(null)">
          <IconifyIconOnline icon="ri:folder-open-line" />素材库
        </el-button>
        <template v-for="folder in breadcrumbs" :key="folder.id">
          <span>/</span>
          <el-button text @click="goToFolder(folder.id)">{{
            folder.name
          }}</el-button>
        </template>
        <template v-if="showingUnfiled">
          <span>/</span><strong>未分类素材</strong>
        </template>
      </div>

      <div v-loading="loading" class="picker-body">
        <template v-if="folderView">
          <p class="picker-hint">请选择文件夹后查看{{ mediaLabel }}。</p>
          <div class="picker-folder-grid">
            <button
              v-for="folder in childFolders"
              :key="folder.id"
              type="button"
              class="picker-folder"
              @click="enterFolder(folder.id)"
            >
              <IconifyIconOnline icon="ri:folder-3-line" />
              <span>{{ folder.name }}</span>
              <small>{{ folder._count?.assets || 0 }} 项素材</small>
            </button>
            <button type="button" class="picker-folder" @click="showUnfiled">
              <IconifyIconOnline icon="ri:archive-line" />
              <span>未分类素材</span>
              <small>查看未放入文件夹的素材</small>
            </button>
          </div>
          <el-empty
            v-if="!childFolders.length"
            description="暂无文件夹，可在素材管理中新建文件夹"
          />
        </template>

        <template v-else>
          <div class="picker-toolbar">
            <el-input
              v-model="keyword"
              clearable
              placeholder="在当前文件夹搜索文件名"
              @clear="search"
              @keyup.enter="search"
            />
            <el-button @click="search">搜索</el-button>
            <el-upload
              v-if="canUpload"
              :show-file-list="false"
              :accept="uploadAccept"
              :http-request="upload"
              :disabled="uploading"
            >
              <el-button :loading="uploading" type="primary">
                <IconifyIconOnline icon="ri:upload-2-line" />上传{{
                  mediaLabel
                }}
              </el-button>
            </el-upload>
          </div>

          <div v-if="childFolders.length" class="picker-folder-grid nested">
            <button
              v-for="folder in childFolders"
              :key="folder.id"
              type="button"
              class="picker-folder"
              @click="enterFolder(folder.id)"
            >
              <IconifyIconOnline icon="ri:folder-3-line" />
              <span>{{ folder.name }}</span>
              <small>{{ folder._count?.assets || 0 }} 项素材</small>
            </button>
          </div>

          <div class="picker-grid">
            <button
              v-for="item in items"
              :key="item.id"
              type="button"
              class="picker-item"
              :class="{ selected: selected.includes(item.id) }"
              @click="toggle(item)"
            >
              <img
                v-if="item.mimeType.startsWith('image/')"
                :src="resolveMediaUrl(item.webpUrl || item.url)"
                :alt="item.originalName || item.filename"
              />
              <VideoThumbnail
                v-else-if="item.mimeType.startsWith('video/')"
                class="picker-video"
                :src="item.url"
                :poster="item.thumbnailUrl"
                :label="item.originalName || item.filename"
              />
              <div v-else class="file-placeholder">
                <IconifyIconOnline icon="ri:file-video-line" />
              </div>
              <span>{{ item.originalName || item.filename }}</span>
            </button>
          </div>
          <el-empty
            v-if="!loading && !items.length && !childFolders.length"
            description="当前文件夹暂无素材"
          />
          <div v-if="total > pageSize" class="picker-pagination">
            <el-pagination
              v-model:current-page="page"
              :page-size="pageSize"
              layout="prev, pager, next"
              :total="total"
              @current-change="loadMedia"
            />
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="confirm">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.media-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.selected-media {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  width: min(320px, 100%);
  min-width: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5e8ec;
  border-radius: 5px;
}

.selected-media img,
.selected-media-file {
  display: grid;
  place-items: center;
  width: 54px;
  height: 42px;
  object-fit: cover;
  background: #eef0f2;
}

.selected-media-video {
  width: 54px;
  height: 42px;
}

.selected-media-file {
  font-size: 20px;
}

.selected-media span {
  min-width: 0;
  padding: 0 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  white-space: nowrap;
}

.picker-path {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  min-height: 32px;
  margin-bottom: 10px;
  font-size: 13px;
  color: #7a838d;
}

.picker-path :deep(.el-button) {
  height: 28px;
  padding: 0 4px;
}

.picker-body {
  min-height: 360px;
}

.picker-hint {
  margin: 2px 0 14px;
  font-size: 13px;
  color: #7a838d;
}

.picker-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.picker-toolbar > :first-child {
  flex: 1;
}

.picker-folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(174px, 1fr));
  gap: 10px;
}

.picker-folder-grid.nested {
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid #e9edf1;
}

.picker-folder {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 2px 8px;
  align-items: center;
  min-height: 72px;
  padding: 11px;
  overflow: hidden;
  color: #1d2732;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dfe5eb;
  border-radius: 5px;
}

.picker-folder:hover {
  border-color: #c72c35;
  box-shadow: 0 2px 8px rgb(199 44 53 / 12%);
}

.picker-folder :deep(svg) {
  grid-row: span 2;
  font-size: 25px;
  color: #c72c35;
}

.picker-folder span,
.picker-folder small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-folder small {
  font-size: 11px;
  color: #7a838d;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  max-height: 52vh;
  overflow: auto;
}

.picker-item {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 2px solid #e5e8ec;
  border-radius: 5px;
}

.picker-item.selected {
  border-color: #c72c35;
  box-shadow: inset 0 0 0 1px #c72c35;
}

.picker-item img,
.file-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: #eef0f2;
}

.picker-video {
  width: 100%;
  aspect-ratio: 4 / 3;
}

.file-placeholder {
  font-size: 32px;
}

.picker-item span {
  display: block;
  padding: 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  white-space: nowrap;
}

.picker-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

@media (width <= 640px) {
  .picker-toolbar {
    flex-wrap: wrap;
  }

  .picker-toolbar > :first-child {
    flex-basis: 100%;
  }
}
</style>
