<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { updateMedia, type MediaFolder } from "@/api/media";
import type { MediaAsset } from "@/types/business";
import { hasPerms } from "@/utils/auth";
import { resolveMediaUrl } from "@/utils/media";
import VideoThumbnail from "@/components/VideoThumbnail/index.vue";

const props = defineProps<{
  asset: MediaAsset | null;
  folders: MediaFolder[];
  mode?: "edit" | "move";
}>();
const emit = defineEmits<{
  saved: [];
}>();
const open = defineModel<boolean>({ required: true });
const saving = ref(false);
const editForm = reactive({ originalName: "", folderId: "" });
const referenceCount = computed(() =>
  props.asset
    ? Object.values(props.asset._count || {}).reduce(
        (sum, count) => sum + Number(count),
        0
      )
    : 0
);

function folderPath(folder: MediaFolder): string {
  const names = [folder.name];
  const visited = new Set([folder.id]);
  let parentId = folder.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = props.folders.find(item => item.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(" / ");
}

function syncForm(asset: MediaAsset | null): void {
  if (!asset) return;
  Object.assign(editForm, {
    originalName: asset.originalName || asset.filename,
    folderId: asset.folderId || ""
  });
}

watch(() => props.asset, syncForm, { immediate: true });
watch(open, value => {
  if (value) syncForm(props.asset);
});

async function save(): Promise<void> {
  if (!props.asset) return;
  saving.value = true;
  try {
    await updateMedia(props.asset.id, {
      ...(props.mode === "move" ? {} : { originalName: editForm.originalName }),
      folderId: editForm.folderId || null
    });
    ElMessage.success(props.mode === "move" ? "素材已移动，图片地址保持不变" : "素材信息已保存");
    open.value = false;
    emit("saved");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="open" :title="mode === 'move' ? '移动素材' : '编辑素材'" width="min(620px,94vw)">
    <div v-if="asset" class="asset-detail">
      <img
        v-if="asset.mimeType.startsWith('image/')"
        :src="resolveMediaUrl(asset.webpUrl || asset.url)"
        alt=""
      />
      <VideoThumbnail
        v-else-if="asset.mimeType.startsWith('video/')"
        class="asset-detail__preview"
        :src="asset.url"
        :poster="asset.thumbnailUrl"
        :label="asset.originalName || asset.filename"
      />
      <div>
        <div>对象 Key：{{ asset.objectKey || "-" }}</div>
        <div>存储驱动：{{ asset.driver || "-" }}</div>
        <div>引用次数：{{ referenceCount }}</div>
      </div>
    </div>
    <el-form label-position="top">
      <el-form-item v-if="mode !== 'move'" label="显示名称">
        <el-input v-model="editForm.originalName" />
      </el-form-item>
      <el-form-item label="文件夹">
        <el-select v-model="editForm.folderId" clearable placeholder="根目录" aria-label="目标文件夹">
          <el-option label="根目录" value="" />
          <el-option
            v-for="folder in folders"
            :key="folder.id"
            :label="folderPath(folder)"
            :value="folder.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="open = false">取消</el-button>
      <el-button
        v-if="hasPerms('media:upload')"
        type="primary"
        :loading="saving"
        @click="save"
      >
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.asset-detail {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 14px;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--ops-muted);
}

.asset-detail img,
.asset-detail__preview {
  width: 140px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
}

.asset-detail div div {
  margin-bottom: 7px;
  overflow-wrap: anywhere;
}
</style>
