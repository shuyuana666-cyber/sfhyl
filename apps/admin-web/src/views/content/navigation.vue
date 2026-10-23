<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createNavigation,
  deleteNavigation,
  getNavigation,
  sortNavigation,
  updateNavigation,
  type ContentRecord
} from "@/api/content";
import { hasPerms } from "@/utils/auth";

defineOptions({ name: "Navigation" });
const rows = ref<ContentRecord[]>([]);
const loading = ref(false);
const open = ref(false);
const saving = ref(false);
const editingId = ref("");
const keyword = ref("");
const form = reactive({
  key: "",
  labelZh: "",
  labelEn: "",
  labelRu: "",
  href: "/",
  target: "SAME_TAB",
  icon: "",
  parentId: "",
  sortOrder: 0,
  isEnabled: true
});
const topLevel = computed(() =>
  rows.value.filter(item => !item.parentId && item.id !== editingId.value)
);
async function load() {
  loading.value = true;
  try {
    rows.value = await getNavigation({ keyword: keyword.value || undefined });
  } finally {
    loading.value = false;
  }
}
function reset() {
  Object.assign(form, {
    key: "",
    labelZh: "",
    labelEn: "",
    labelRu: "",
    href: "/",
    target: "SAME_TAB",
    icon: "",
    parentId: "",
    sortOrder: rows.value.length,
    isEnabled: true
  });
}
function create() {
  editingId.value = "";
  reset();
  open.value = true;
}
function edit(row: ContentRecord) {
  editingId.value = row.id;
  reset();
  Object.keys(form).forEach(k => {
    if (row[k] !== undefined && row[k] !== null)
      (form as Record<string, unknown>)[k] = row[k];
  });
  open.value = true;
}
async function save() {
  if (!form.key || !form.labelZh || !form.labelEn || !form.href) {
    ElMessage.warning("请填写标识、名称和链接");
    return;
  }
  saving.value = true;
  try {
    const data = { ...form, parentId: form.parentId || null };
    editingId.value
      ? await updateNavigation(editingId.value, data)
      : await createNavigation(data);
    ElMessage.success("导航已保存");
    open.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: ContentRecord) {
  await ElMessageBox.confirm(`确认删除“${row.labelZh}”？`, "删除确认", {
    type: "warning"
  });
  await deleteNavigation(row.id);
  await load();
}
async function move(row: ContentRecord, direction: -1 | 1) {
  const siblings = rows.value.filter(
    item => (item.parentId || "") === (row.parentId || "")
  );
  const index = siblings.findIndex(item => item.id === row.id);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return;
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  await sortNavigation(
    siblings.map((item, sortOrder) => ({ id: item.id, sortOrder }))
  );
  await load();
}
onMounted(load);
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>导航菜单</h1>
        <p>官网主导航与二级菜单</p>
      </div>
      <el-button
        v-if="hasPerms('navigation:manage')"
        type="primary"
        @click="create"
        ><IconifyIconOnline icon="ri:add-line" />新增菜单</el-button
      >
    </div>
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="菜单名称或标识"
        style="width: 240px"
        @keyup.enter="load"
      /><el-button type="primary" @click="load">查询</el-button>
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows" row-key="id"
        ><el-table-column label="菜单" min-width="220"
          ><template #default="{ row }"
            ><div :class="{ 'child-label': row.parentId }">
              <strong>{{ row.labelZh }}</strong
              ><span>{{ row.labelEn }}</span>
            </div></template
          ></el-table-column
        ><el-table-column prop="key" label="标识" width="140" /><el-table-column
          prop="href"
          label="链接"
          min-width="180"
        /><el-table-column label="父级" width="120"
          ><template #default="{ row }">{{
            row.parent?.labelZh || "-"
          }}</template></el-table-column
        ><el-table-column label="状态" width="80"
          ><template #default="{ row }"
            ><el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{
              row.isEnabled ? "显示" : "隐藏"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="排序" width="110"
          ><template #default="{ row }"
            ><el-button
              v-if="hasPerms('navigation:manage')"
              circle
              text
              @click="move(row as ContentRecord, -1)"
              ><IconifyIconOnline icon="ri:arrow-up-line" /></el-button
            ><el-button
              v-if="hasPerms('navigation:manage')"
              circle
              text
              @click="move(row as ContentRecord, 1)"
              ><IconifyIconOnline
                icon="ri:arrow-down-line" /></el-button></template></el-table-column
        ><el-table-column label="操作" width="130"
          ><template #default="{ row }"
            ><el-button
              v-if="hasPerms('navigation:manage')"
              link
              type="primary"
              @click="edit(row as ContentRecord)"
              >编辑</el-button
            ><el-button
              v-if="hasPerms('navigation:manage')"
              link
              type="danger"
              @click="remove(row as ContentRecord)"
              >删除</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </div>
    <el-dialog
      v-model="open"
      :title="editingId ? '编辑菜单' : '新增菜单'"
      width="min(620px,94vw)"
      ><el-form label-position="top"
        ><div class="dialog-grid">
          <el-form-item label="唯一标识" required
            ><el-input v-model="form.key" /></el-form-item
          ><el-form-item label="父级菜单"
            ><el-select v-model="form.parentId" clearable
              ><el-option
                v-for="item in topLevel"
                :key="item.id"
                :label="item.labelZh"
                :value="item.id" /></el-select></el-form-item
          ><el-form-item label="中文名称" required
            ><el-input v-model="form.labelZh" /></el-form-item
          ><el-form-item label="英文名称" required
            ><el-input v-model="form.labelEn" /></el-form-item
          ><el-form-item label="俄文名称"
            ><el-input v-model="form.labelRu" /></el-form-item
          ><el-form-item label="图标名"
            ><el-input v-model="form.icon" /></el-form-item
          ><el-form-item label="站内路径或外部链接" required
            ><el-input v-model="form.href" /></el-form-item
          ><el-form-item label="打开方式"
            ><el-select v-model="form.target"
              ><el-option label="当前窗口" value="SAME_TAB" /><el-option
                label="新窗口"
                value="NEW_TAB" /></el-select></el-form-item
          ><el-form-item label="是否显示"
            ><el-switch v-model="form.isEnabled"
          /></el-form-item></div></el-form
      ><template #footer
        ><el-button @click="open = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
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

.child-label {
  padding-left: 24px;
}

.child-label::before {
  margin-right: 8px;
  color: var(--ops-muted);
  content: "└";
}

.child-label span,
.table-wrap strong + span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: var(--ops-muted);
}

@media (width <= 620px) {
  .dialog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
