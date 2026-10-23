<script setup lang="ts">
import dayjs from "dayjs";
import { formatBytes } from "@/utils/format-bytes";
import type { MediaAsset } from "@/types/business";
import { hasPerms } from "@/utils/auth";
import { resolveMediaUrl } from "@/utils/media";
import VideoThumbnail from "@/components/VideoThumbnail/index.vue";

defineProps<{
  item: MediaAsset;
  deleted: boolean;
  selected: boolean;
}>();

const emit = defineEmits<{
  selection: [checked: boolean];
  preview: [item: MediaAsset];
  edit: [item: MediaAsset];
  copy: [url: string];
  move: [item: MediaAsset];
  restore: [item: MediaAsset];
  permanent: [item: MediaAsset];
}>();

function isPreviewable(item: MediaAsset): boolean {
  return (
    item.mimeType.startsWith("image/") || item.mimeType.startsWith("video/")
  );
}
</script>

<template>
  <article class="media-item" :class="{ 'media-item--selected': selected }">
    <el-checkbox
      v-if="!deleted"
      class="media-item__select"
      :model-value="selected"
      :aria-label="`选择 ${item.originalName || item.filename}`"
      @click.stop
      @change="value => emit('selection', Boolean(value))"
    />
    <div
      class="preview-wrap"
      :class="{ 'preview-wrap--interactive': isPreviewable(item) }"
      :role="isPreviewable(item) ? 'button' : undefined"
      :tabindex="isPreviewable(item) ? 0 : undefined"
      :aria-label="
        isPreviewable(item)
          ? `Preview ${item.originalName || item.filename}`
          : undefined
      "
      @click="emit('preview', item)"
      @keydown.enter.prevent="emit('preview', item)"
      @keydown.space.prevent="emit('preview', item)"
    >
      <img
        v-if="item.mimeType.startsWith('image/')"
        :src="resolveMediaUrl(item.thumbnailUrl || item.url)"
        :alt="item.altZh || item.originalName || item.filename"
        class="media-item__preview"
      />
      <VideoThumbnail
        v-else-if="item.mimeType.startsWith('video/')"
        class="media-item__preview"
        :src="item.url"
        :poster="item.thumbnailUrl"
        :label="item.originalName || item.filename"
      />
      <div v-else class="file-preview">
        <IconifyIconOnline
          :icon="
            item.mimeType.startsWith('video/')
              ? 'ri:video-line'
              : 'ri:file-line'
          "
        />
      </div>
      <span class="mime-badge">{{
        item.extension?.toUpperCase() || item.mimeType.split("/")[1]
      }}</span>
      <span
        v-if="isPreviewable(item)"
        class="preview-open-affordance"
        aria-hidden="true"
      >
        <IconifyIconOnline icon="ri:fullscreen-line" />
      </span>
    </div>
    <div class="media-item__body">
      <strong :title="item.originalName || item.filename">
        {{ item.originalName || item.filename }}
      </strong>
      <div class="media-meta">
        {{ item.width && item.height ? `${item.width} x ${item.height} · ` : ""
        }}{{ formatBytes(item.sizeBytes) }}
      </div>
      <div class="media-meta">
        {{ dayjs(item.createdAt).format("YYYY-MM-DD HH:mm") }}
      </div>
      <div class="media-tools">
        <template v-if="!deleted">
          <el-tooltip v-if="hasPerms('media:upload')" content="编辑信息">
            <el-button circle text @click="emit('edit', item)">
              <IconifyIconOnline icon="ri:edit-line" />
            </el-button>
          </el-tooltip>
          <el-tooltip v-if="hasPerms('media:upload')" content="移动素材">
            <el-button
              circle
              text
              aria-label="移动素材"
              @click="emit('move', item)"
            >
              <IconifyIconOnline icon="ri:folder-transfer-line" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="复制 URL">
            <el-button
              circle
              text
              @click="emit('copy', item.webpUrl || item.url)"
            >
              <IconifyIconOnline icon="ri:file-copy-line" />
            </el-button>
          </el-tooltip>
          <el-tooltip v-if="hasPerms('media:delete')" content="彻底删除">
            <el-button
              circle
              text
              type="danger"
              aria-label="彻底删除"
              @click="emit('permanent', item)"
            >
              <IconifyIconOnline icon="ri:delete-bin-line" />
            </el-button>
          </el-tooltip>
        </template>
        <template v-else-if="hasPerms('media:delete')">
          <el-button link type="success" @click="emit('restore', item)">
            恢复
          </el-button>
          <el-button link type="danger" @click="emit('permanent', item)">
            永久删除
          </el-button>
        </template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.media-item {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 6px;
}

.media-item--selected {
  border-color: var(--ops-accent);
  box-shadow: 0 0 0 2px rgb(199 44 53 / 12%);
}

.media-item__select {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  padding: 4px;
  background: rgb(255 255 255 / 90%);
  border-radius: 4px;
}

.preview-wrap {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  text-align: inherit;
  background: transparent;
  border: 0;
}

.preview-wrap--interactive {
  cursor: zoom-in;
}

.preview-wrap--interactive:focus-visible {
  outline: 2px solid var(--ops-accent);
  outline-offset: 2px;
}

.preview-open-affordance {
  position: absolute;
  top: 7px;
  right: 7px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: #fff;
  pointer-events: none;
  background: rgb(23 32 42 / 78%);
  border-radius: 4px;
  opacity: 0;
  transition: opacity 160ms ease;
}

.preview-wrap--interactive:hover .preview-open-affordance,
.preview-wrap--interactive:focus-visible .preview-open-affordance {
  opacity: 1;
}

.file-preview {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 4/3;
  font-size: 44px;
  background: #eef0f2;
}

.mime-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 2px 5px;
  font-size: 10px;
  color: #fff;
  background: rgb(23 32 42/78%);
  border-radius: 3px;
}

.media-item__body strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  white-space: nowrap;
}

.media-meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--ops-muted);
}

.media-tools {
  display: flex;
  justify-content: flex-end;
  padding-top: 5px;
  margin-top: 7px;
  border-top: 1px solid var(--ops-line);
}
</style>
