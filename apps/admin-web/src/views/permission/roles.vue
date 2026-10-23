<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createRole,
  deleteRole,
  getPermissions,
  getRoles,
  updateRole,
  type Permission,
  type Role
} from "@/api/roles";
import { hasPerms } from "@/utils/auth";

defineOptions({ name: "Roles" });
const loading = ref(false);
const rows = ref<Role[]>([]);
const permissions = ref<Permission[]>([]);
const open = ref(false);
const saving = ref(false);
const editingId = ref("");
const form = reactive({
  code: "",
  nameZh: "",
  nameEn: "",
  description: "",
  isEnabled: true,
  permissionCodes: [] as string[]
});
const grouped = computed(() =>
  permissions.value.reduce<Record<string, Permission[]>>((result, item) => {
    (result[item.module || "other"] ??= []).push(item);
    return result;
  }, {})
);
async function load() {
  loading.value = true;
  try {
    [rows.value, permissions.value] = await Promise.all([
      getRoles(),
      getPermissions()
    ]);
  } finally {
    loading.value = false;
  }
}
function reset() {
  Object.assign(form, {
    code: "",
    nameZh: "",
    nameEn: "",
    description: "",
    isEnabled: true,
    permissionCodes: []
  });
}
function create() {
  editingId.value = "";
  reset();
  open.value = true;
}
function edit(row: Role) {
  editingId.value = row.id;
  reset();
  Object.assign(form, {
    code: row.code,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    description: row.description || "",
    isEnabled: row.isEnabled,
    permissionCodes:
      row.permissions?.map(
        (item: Record<string, Permission>) => item.permission.code
      ) || []
  });
  open.value = true;
}
async function save() {
  if (!form.code || !form.nameZh || !form.nameEn) {
    ElMessage.warning("请填写角色编码和名称");
    return;
  }
  saving.value = true;
  try {
    const data = {
      nameZh: form.nameZh,
      nameEn: form.nameEn,
      description: form.description,
      isEnabled: form.isEnabled,
      permissionCodes: form.permissionCodes
    };
    editingId.value
      ? await updateRole(editingId.value, data)
      : await createRole({ ...data, code: form.code });
    ElMessage.success("角色已保存");
    open.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: Role) {
  await ElMessageBox.confirm(`确认删除角色“${row.nameZh}”？`, "删除角色", {
    type: "warning"
  });
  await deleteRole(row.id);
  await load();
}
function toggleModule(items: Permission[], checked: boolean) {
  const codes = new Set(form.permissionCodes);
  items.forEach(item =>
    checked ? codes.add(item.code) : codes.delete(item.code)
  );
  form.permissionCodes = [...codes];
}
onMounted(load);
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>角色权限</h1>
        <p>按业务模块分配权限码，系统角色受保护</p>
      </div>
      <el-button v-if="hasPerms('role:create')" type="primary" @click="create"
        ><IconifyIconOnline icon="ri:add-line" />新增角色</el-button
      >
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows"
        ><el-table-column label="角色" min-width="180"
          ><template #default="{ row }"
            ><strong>{{ row.nameZh }}</strong>
            <div class="subline">
              {{ row.nameEn }} · {{ row.code }}
            </div></template
          ></el-table-column
        ><el-table-column
          prop="description"
          label="说明"
          min-width="220"
        /><el-table-column label="权限数" width="90" align="center"
          ><template #default="{ row }">{{
            row.permissions?.length || 0
          }}</template></el-table-column
        ><el-table-column label="用户数" width="90" align="center"
          ><template #default="{ row }">{{
            row._count?.users || 0
          }}</template></el-table-column
        ><el-table-column label="类型" width="90"
          ><template #default="{ row }"
            ><el-tag :type="row.isSystem ? 'warning' : 'info'" size="small">{{
              row.isSystem ? "系统" : "自定义"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="状态" width="80"
          ><template #default="{ row }"
            ><el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{
              row.isEnabled ? "启用" : "停用"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="操作" width="130"
          ><template #default="{ row }"
            ><el-button
              v-if="hasPerms('role:update')"
              link
              type="primary"
              @click="edit(row as Role)"
              >编辑</el-button
            ><el-button
              v-if="hasPerms('role:delete') && !row.isSystem"
              link
              type="danger"
              @click="remove(row as Role)"
              >删除</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </div>
    <el-dialog
      v-model="open"
      :title="editingId ? '编辑角色' : '新增角色'"
      width="min(860px,95vw)"
      ><el-form label-position="top"
        ><div class="dialog-grid">
          <el-form-item label="角色编码" required
            ><el-input
              v-model="form.code"
              :disabled="Boolean(editingId)"
              placeholder="content_editor" /></el-form-item
          ><el-form-item label="状态"
            ><el-switch v-model="form.isEnabled" /></el-form-item
          ><el-form-item label="中文名称" required
            ><el-input v-model="form.nameZh" /></el-form-item
          ><el-form-item label="英文名称" required
            ><el-input v-model="form.nameEn" /></el-form-item
          ><el-form-item label="说明" class="span-2"
            ><el-input v-model="form.description" type="textarea"
          /></el-form-item>
        </div>
        <div class="permission-heading">
          <h3>权限分配</h3>
          <span>已选择 {{ form.permissionCodes.length }} 项</span>
        </div>
        <div class="permission-groups">
          <section v-for="(items, module) in grouped" :key="module">
            <div class="module-title">
              <strong>{{ module }}</strong
              ><el-checkbox
                :model-value="
                  items.every(item => form.permissionCodes.includes(item.code))
                "
                @change="value => toggleModule(items, Boolean(value))"
                >全选</el-checkbox
              >
            </div>
            <el-checkbox-group v-model="form.permissionCodes"
              ><el-checkbox
                v-for="item in items"
                :key="item.code"
                :value="item.code"
                ><span>{{ item.nameZh || item.code }}</span
                ><small>{{ item.code }}</small></el-checkbox
              ></el-checkbox-group
            >
          </section>
        </div></el-form
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
.subline {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ops-muted);
}

.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.span-2 {
  grid-column: span 2;
}

.permission-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--ops-line);
}

.permission-heading h3 {
  font-size: 15px;
}

.permission-heading span {
  font-size: 12px;
  color: var(--ops-muted);
}

.permission-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 46vh;
  overflow: auto;
}

.permission-groups section {
  padding: 12px;
  border: 1px solid var(--ops-line);
  border-radius: 6px;
}

.module-title {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.permission-groups .el-checkbox-group {
  display: grid;
  gap: 6px;
}

.permission-groups small {
  display: block;
  font-size: 10px;
  color: var(--ops-muted);
}

@media (width <= 660px) {
  .dialog-grid,
  .permission-groups {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
