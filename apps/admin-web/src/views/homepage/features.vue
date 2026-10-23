<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import MediaPicker from "@/components/MediaPicker/index.vue";
import {
  createFeature,
  deleteFeature,
  getFeatures,
  sortFeatures,
  updateFeature,
  type HomepageRecord
} from "@/api/homepage";
import { hasPerms } from "@/utils/auth";
import { resolveMediaUrl } from "@/utils/media";

defineOptions({ name: "HomepageFeatures" });
const rows = ref<HomepageRecord[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const editingId = ref("");
const form = reactive({
  key: "",
  iconType: "BUILTIN",
  iconName: "ri:shield-check-line",
  svgContent: "",
  imageMediaId: null as string | null,
  titleZh: "",
  titleEn: "",
  descriptionZh: "",
  descriptionEn: "",
  linkUrl: "",
  sortOrder: 0,
  isEnabled: true
});
async function load() {
  loading.value = true;
  try {
    rows.value = await getFeatures();
  } finally {
    loading.value = false;
  }
}
function reset() {
  Object.assign(form, {
    key: "",
    iconType: "BUILTIN",
    iconName: "ri:shield-check-line",
    svgContent: "",
    imageMediaId: null,
    titleZh: "",
    titleEn: "",
    descriptionZh: "",
    descriptionEn: "",
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
  Object.keys(form).forEach(k => {
    if (row[k] !== undefined && row[k] !== null)
      (form as Record<string, unknown>)[k] = row[k];
  });
  open.value = true;
}
function payload() {
  return Object.fromEntries(
    Object.entries(form).filter(([, v]) => v !== "" && v !== null)
  );
}
async function save() {
  if (!form.key || !form.titleZh || !form.titleEn) {
    ElMessage.warning("请填写标识和中英文标题");
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
  } finally {
    saving.value = false;
  }
}
async function remove(row: HomepageRecord) {
  await ElMessageBox.confirm(`确认删除“${row.titleZh}”？`, "删除确认", {
    type: "warning"
  });
  await deleteFeature(row.id);
  await load();
}
async function move(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= rows.value.length) return;
  const next = [...rows.value];
  [next[index], next[target]] = [next[target], next[index]];
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
        <h1>首页优势图标</h1>
        <p>维护服务优势、图标来源和多语言内容</p>
      </div>
      <el-button
        v-if="hasPerms('homepage:manage')"
        type="primary"
        @click="create"
        ><IconifyIconOnline icon="ri:add-line" />新增优势</el-button
      >
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows">
        <el-table-column label="图标" width="80"
          ><template #default="{ row }"
            ><el-image
              v-if="row.imageMedia?.url"
              :src="resolveMediaUrl(row.imageMedia.url)"
              fit="contain"
              style="width: 38px; height: 38px" /><IconifyIconOnline
              v-else
              :icon="row.iconName || 'ri:star-line'"
              class="feature-icon" /></template></el-table-column
        ><el-table-column
          prop="titleZh"
          label="中文标题"
          min-width="150"
        /><el-table-column
          prop="titleEn"
          label="英文标题"
          min-width="170"
        /><el-table-column
          prop="key"
          label="标识"
          width="140"
        /><el-table-column label="状态" width="80"
          ><template #default="{ row }"
            ><el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{
              row.isEnabled ? "显示" : "隐藏"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column
          v-if="hasPerms('homepage:manage')"
          label="排序"
          width="110"
          ><template #default="{ $index }"
            ><el-button
              circle
              text
              :disabled="$index === 0"
              @click="move($index, -1)"
              ><IconifyIconOnline icon="ri:arrow-up-line" /></el-button
            ><el-button
              circle
              text
              :disabled="$index === rows.length - 1"
              @click="move($index, 1)"
              ><IconifyIconOnline
                icon="ri:arrow-down-line" /></el-button></template></el-table-column
        ><el-table-column
          v-if="hasPerms('homepage:manage')"
          label="操作"
          width="130"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="edit(row as HomepageRecord)"
              >编辑</el-button
            ><el-button
              link
              type="danger"
              @click="remove(row as HomepageRecord)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </div>
    <el-dialog
      v-model="open"
      :title="editingId ? '编辑优势' : '新增优势'"
      width="min(720px,94vw)"
      ><el-form label-position="top"
        ><div class="dialog-grid">
          <el-form-item label="唯一标识" required
            ><el-input v-model="form.key" /></el-form-item
          ><el-form-item label="图标类型"
            ><el-select v-model="form.iconType"
              ><el-option label="内置图标" value="BUILTIN" /><el-option
                label="SVG"
                value="SVG" /><el-option
                label="上传图片"
                value="IMAGE" /></el-select></el-form-item
          ><el-form-item
            v-if="form.iconType === 'BUILTIN'"
            label="Iconify 图标名"
            ><el-input v-model="form.iconName" /></el-form-item
          ><el-form-item v-if="form.iconType === 'IMAGE'" label="图标图片"
            ><MediaPicker v-model="form.imageMediaId" /></el-form-item
          ><el-form-item
            v-if="form.iconType === 'SVG'"
            label="SVG 内容"
            class="span-2"
            ><el-input
              v-model="form.svgContent"
              type="textarea"
              :rows="5" /></el-form-item
          ><el-form-item label="中文标题" required
            ><el-input v-model="form.titleZh" /></el-form-item
          ><el-form-item label="英文标题" required
            ><el-input v-model="form.titleEn" /></el-form-item
          ><el-form-item label="中文描述"
            ><el-input
              v-model="form.descriptionZh"
              type="textarea" /></el-form-item
          ><el-form-item label="英文描述"
            ><el-input
              v-model="form.descriptionEn"
              type="textarea" /></el-form-item
          ><el-form-item label="跳转链接"
            ><el-input v-model="form.linkUrl" /></el-form-item
          ><el-form-item label="是否显示"
            ><el-switch v-model="form.isEnabled"
          /></el-form-item></div></el-form
      ><template #footer
        ><el-button @click="open = false">取消</el-button
        ><el-button
          v-if="hasPerms('homepage:manage')"
          type="primary"
          :loading="saving"
          @click="save"
          >保存</el-button
        ></template
      ></el-dialog
    >
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

@media (width <= 620px) {
  .dialog-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
