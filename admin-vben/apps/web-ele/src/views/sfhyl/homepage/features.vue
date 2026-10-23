<script setup lang="ts">
import type { MediaAsset } from "@/types/business";

import { onMounted, reactive, ref } from "vue";

import {
  createFeature,
  deleteFeature,
  getFeatures,
  type HomepageRecord,
  sortFeatures,
  updateFeature
} from "@/api/homepage";
import MediaPicker from "@/components/MediaPicker/index.vue";
import PageLoadState from "@/components/PageLoadState/index.vue";
import { usePageLoad } from "@/composables/usePageLoad";
import { showActionError } from "@/utils/action-feedback";
import { hasPerms } from "@/utils/auth";
import { confirmAction } from "@/utils/confirm-action";
import { resolveMediaUrl } from "@/utils/media";
import { ElMessage } from "element-plus";

defineOptions({ name: "HomepageFeatures" });
const rows = ref<HomepageRecord[]>([]);
const { loading, loadError, runLoad } = usePageLoad();
const open = ref(false);
const saving = ref(false);
const editingId = ref("");
const previewAsset = ref<MediaAsset | null>(null);
const form = reactive({
  key: "",
  iconType: "BUILTIN",
  iconName: "ri:shield-check-line",
  svgContent: "",
  imageMediaId: null as null | string,
  titleZh: "",
  titleEn: "",
  titleRu: "",
  descriptionZh: "",
  descriptionEn: "",
  descriptionRu: "",
  linkUrl: "",
  sortOrder: 0,
  isEnabled: true
});
async function load() {
  await runLoad(async () => {
    rows.value = await getFeatures();
  });
}
function reset() {
  previewAsset.value = null;
  Object.assign(form, {
    key: "",
    iconType: "BUILTIN",
    iconName: "ri:shield-check-line",
    svgContent: "",
    imageMediaId: null,
    titleZh: "",
    titleEn: "",
    titleRu: "",
    descriptionZh: "",
    descriptionEn: "",
    descriptionRu: "",
    linkUrl: "",
    sortOrder: rows.value.length,
    isEnabled: true
  });
}
function create() {
  editingId.value = "";
  reset();
  open.value = true;
}
function edit(row: HomepageRecord) {
  editingId.value = row.id;
  reset();
  previewAsset.value = (row.imageMedia as MediaAsset | undefined) || null;
  Object.keys(form).forEach(k => {
    if (row[k as keyof HomepageRecord] !== undefined && row[k as keyof HomepageRecord] !== null)
      (form as Record<string, unknown>)[k] = row[k as keyof HomepageRecord];
  });
  open.value = true;
}
function payload() {
  return Object.fromEntries(
    Object.entries(form).filter(([, v]) => v !== "" && v !== null)
  );
}
async function save() {
  if (!form.key || !form.titleZh || !form.titleEn || !form.titleRu) {
    ElMessage.warning("请填写标识和三种语言的标题");
    return;
  }
  saving.value = true;
  try {
    editingId.value
      ? await updateFeature(editingId.value, payload())
      : await createFeature(payload());
    ElMessage.success("优势项目已保存");
    open.value = false;
    await load();
  } catch (error) {
    showActionError(error);
  } finally {
    saving.value = false;
  }
}
async function remove(row: HomepageRecord) {
  if (!(await confirmAction(`确认删除“${row.titleZh}”？`, "删除确认"))) return;
  await deleteFeature(row.id);
  await load();
}
async function move(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= rows.value.length) return;
  const next = [...rows.value];
  [next[index], next[target]] = [next[target]!, next[index]!];
  await sortFeatures(
    next.map((item, sortOrder) => ({ id: item.id, sortOrder }))
  );
  await load();
}
onMounted(load);
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>首页服务优势</h1>
        <p>维护服务优势、展示图片和多语言内容</p>
      </div>
      <el-button
        v-if="hasPerms('homepage:manage')"
        type="primary"
        @click="create"
        >
<IconifyIconOnline icon="ri:add-line" />新增优势
</el-button>
    </div>
    <PageLoadState :loading="loading" :error="loadError" :ready="rows.length > 0" @retry="load" />
    <div v-show="!loadError && (!loading || rows.length > 0)" class="table-wrap">
      <el-table v-loading="loading" :data="rows">
        <el-table-column label="展示图片" width="120">
<template #default="{ row = {} } = {}">
<el-image
              v-if="row.iconType === 'IMAGE' && row.imageMedia?.url"
              :src="resolveMediaUrl(row.imageMedia.url)"
              fit="cover"
              class="feature-photo"
>
<template #error><IconifyIconOnline :icon="row.iconName || 'ri:star-line'" class="feature-icon" /></template>
</el-image><IconifyIconOnline
              v-else
              :icon="row.iconName || 'ri:star-line'"
              class="feature-icon"
/>
</template>
</el-table-column><el-table-column
          prop="titleZh"
          label="中文标题"
          min-width="150"
        /><el-table-column
          prop="titleEn"
          label="英文标题"
          min-width="170"
        /><el-table-column
          prop="titleRu"
          label="俄文标题"
          min-width="170"
        /><el-table-column
          prop="key"
          label="标识"
          width="140"
        /><el-table-column label="状态" width="80">
<template #default="{ row = {} } = {}">
<el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">
{{
              row.isEnabled ? "显示" : "隐藏"
            }}
</el-tag>
</template>
</el-table-column><el-table-column
          v-if="hasPerms('homepage:manage')"
          label="排序"
          width="110"
          >
<template #default="{ $index = 0 } = {}">
<el-button
              circle
              text
              :disabled="$index === 0"
              @click="move($index, -1)"
              >
<IconifyIconOnline icon="ri:arrow-up-line" />
</el-button><el-button
              circle
              text
              :disabled="$index === rows.length - 1"
              @click="move($index, 1)"
              >
<IconifyIconOnline
                icon="ri:arrow-down-line"
/>
</el-button>
</template>
</el-table-column><el-table-column
          v-if="hasPerms('homepage:manage')"
          label="操作"
          width="130"
          >
<template #default="{ row = {} } = {}">
<el-button link type="primary" @click="edit(row as HomepageRecord)">
编辑
</el-button><el-button
              link
              type="danger"
              @click="remove(row as HomepageRecord)"
              >
删除
</el-button>
</template>
</el-table-column>
      </el-table>
    </div>
    <el-dialog
      v-model="open"
      :title="editingId ? '编辑优势' : '新增优势'"
      width="min(720px,94vw)"
      >
<el-form label-position="top">
<div class="dialog-grid">
          <el-form-item label="唯一标识" required>
<el-input v-model="form.key" />
</el-form-item><el-form-item label="展示方式">
<el-select v-model="form.iconType">
<el-option label="内置图标" value="BUILTIN" /><el-option
                label="SVG"
                value="SVG"
/><el-option
                label="横向图片"
                value="IMAGE"
/>
</el-select>
</el-form-item><el-form-item
            v-if="form.iconType === 'BUILTIN'"
            label="Iconify 图标名"
            >
<el-input v-model="form.iconName" />
</el-form-item><el-form-item v-if="form.iconType === 'IMAGE'" label="展示图片" class="feature-photo-field span-2">
<MediaPicker v-model="form.imageMediaId" :asset="previewAsset?.id === form.imageMediaId ? previewAsset : null" @select="previewAsset = $event[0] || null" />
<p class="feature-photo-hint">推荐 1200×675px（16:9）横向照片，主体居中；未设置图片或加载失败时显示原图标。</p>
</el-form-item><el-form-item
            v-if="form.iconType === 'SVG'"
            label="SVG 内容"
            class="span-2"
            >
<el-input
              v-model="form.svgContent"
              type="textarea"
              :rows="5"
/>
</el-form-item><el-form-item label="中文标题" required>
<el-input v-model="form.titleZh" />
</el-form-item><el-form-item label="英文标题" required>
<el-input v-model="form.titleEn" />
</el-form-item><el-form-item label="俄文标题" required>
<el-input v-model="form.titleRu" />
</el-form-item><el-form-item label="中文描述">
<el-input
              v-model="form.descriptionZh"
              type="textarea"
/>
</el-form-item><el-form-item label="英文描述">
<el-input
              v-model="form.descriptionEn"
              type="textarea"
/>
</el-form-item><el-form-item label="俄文描述">
<el-input
              v-model="form.descriptionRu"
              type="textarea"
/>
</el-form-item><el-form-item label="跳转链接">
<el-input v-model="form.linkUrl" />
</el-form-item><el-form-item label="是否显示">
<el-switch v-model="form.isEnabled" />
</el-form-item>
</div>
</el-form><template #footer>
<el-button @click="open = false">取消</el-button><el-button
          v-if="hasPerms('homepage:manage')"
          type="primary"
          :loading="saving"
          @click="save"
          >
保存
</el-button>
</template>
</el-dialog>
  </div>
</template>
<style scoped>
.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.span-2 {
  grid-column: span 2;
}

.feature-icon {
  font-size: 30px;
  color: var(--ops-accent);
}

.feature-photo {
  width: 80px;
  height: 45px;
  border-radius: 4px;
  background: var(--ops-surface);
}

.feature-photo-field :deep(.selected-media img) {
  width: 160px;
  height: 90px;
  object-fit: cover;
  border-radius: 4px;
}

.feature-photo-field :deep(.selected-media) {
  grid-template-columns: 160px minmax(0, 1fr);
  width: min(400px, 100%);
}

.feature-photo-hint {
  margin: 8px 0 0;
  color: var(--ops-muted);
  font-size: 13px;
  line-height: 1.6;
}

@media (width <= 620px) {
  .dialog-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
