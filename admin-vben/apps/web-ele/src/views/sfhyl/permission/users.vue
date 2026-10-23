<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import { getRoles, type Role } from "@/api/roles";
import {
  type AdminUser,
  createUser,
  deleteUser,
  getUsers,
  updateUser
} from "@/api/users";
import PageLoadState from "@/components/PageLoadState/index.vue";
import { usePageLoad } from "@/composables/usePageLoad";
import { showActionError } from "@/utils/action-feedback";
import { hasPerms } from "@/utils/auth";
import { confirmAction } from "@/utils/confirm-action";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";

defineOptions({ name: "Users" });
const { loading, loadError, runLoad } = usePageLoad();
const rows = ref<AdminUser[]>([]);
const roles = ref<Role[]>([]);
const total = ref(0);
const open = ref(false);
const saving = ref(false);
const editingId = ref("");
const validationAttempted = ref(false);
const query = reactive({ page: 1, pageSize: 20, keyword: "", status: "" });
const form = reactive({
  username: "",
  email: "",
  displayName: "",
  password: "",
  status: "ACTIVE",
  roleIds: [] as string[]
});
async function load() {
  await runLoad(async () => {
    const result = await getUsers(
      Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""))
    );
    if (!roles.value.length) roles.value = await getRoles();
    rows.value = result.items;
    total.value = result.pagination.total;
  });
}
function reset() {
  validationAttempted.value = false;
  Object.assign(form, {
    username: "",
    email: "",
    displayName: "",
    password: "",
    status: "ACTIVE",
    roleIds: []
  });
}
function create() {
  editingId.value = "";
  reset();
  open.value = true;
}
function edit(row: AdminUser) {
  editingId.value = row.id;
  reset();
  Object.assign(form, {
    username: row.username,
    email: row.email || "",
    displayName: row.displayName || "",
    status: row.status,
    roleIds: row.roles?.map(item => item.role.id) || []
  });
  open.value = true;
}
async function save() {
  validationAttempted.value = true;
  if (
    !form.username ||
    !form.email ||
    !form.roleIds.length ||
    (!editingId.value && form.password.length < 12)
  ) {
    ElMessage.warning("请填写账号、邮箱、角色，并设置至少 12 位密码");
    return;
  }
  saving.value = true;
  try {
    if (editingId.value)
      await updateUser(editingId.value, {
        email: form.email,
        displayName: form.displayName,
        status: form.status,
        roleIds: form.roleIds
      });
    else await createUser(form);
    ElMessage.success("管理员已保存");
    open.value = false;
    await load();
  } catch (error) {
    showActionError(error);
  } finally {
    saving.value = false;
  }
}
async function remove(row: AdminUser) {
  if (!(await confirmAction(
    `确认删除管理员“${row.username}”？`,
    "删除管理员"))) return;
  await deleteUser(row.id);
  await load();
}
onMounted(load);
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>管理员</h1>
        <p>账号状态、角色和后台访问权限</p>
      </div>
      <el-button v-if="hasPerms('user:create')" :disabled="loading || !!loadError" type="primary" @click="create">
<IconifyIconOnline icon="ri:user-add-line" />新增管理员
</el-button>
    </div>
    <PageLoadState :loading="loading" :error="loadError" :ready="rows.length > 0" @retry="load" />
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="用户名 / 邮箱 / 姓名"
        aria-label="用户名 / 邮箱 / 姓名"
        style="width: 250px"
        @keyup.enter="
          query.page = 1;
          load();
        "
      /><el-select
        v-model="query.status"
        clearable
        placeholder="账号状态"
        aria-label="账号状态"
        style="width: 130px"
        >
<el-option label="正常" value="ACTIVE" /><el-option
          label="停用"
          value="DISABLED"
/><el-option
          label="锁定"
          value="LOCKED"
/>
</el-select><el-button
        type="primary"
        @click="
          query.page = 1;
          load();
        "
        >
查询
</el-button>
    </div>
    <div v-show="!loadError && (!loading || rows.length > 0)" class="table-wrap">
      <el-table v-loading="loading" :data="rows" empty-text="暂无符合条件的管理员">
<el-table-column label="管理员" min-width="190">
<template #default="{ row = {} } = {}">
<strong>{{ row.displayName || row.username }}</strong>
            <div class="subline">
              {{ row.username }} · {{ row.email }}
            </div>
</template>
</el-table-column><el-table-column label="角色" min-width="220">
<template #default="{ row = {} } = {}">
<el-tag
              v-for="item in row.roles"
              :key="item.role.id"
              size="small"
              class="role-tag"
              >
{{ item.role.nameZh }}
</el-tag>
</template>
</el-table-column><el-table-column label="状态" width="90">
<template #default="{ row = {} } = {}">
<el-tag
              :type="
                row.status === 'ACTIVE'
                  ? 'success'
                  : row.status === 'LOCKED'
                    ? 'danger'
                    : 'info'
              "
              >
{{
                { ACTIVE: "正常", DISABLED: "停用", LOCKED: "锁定" }[row.status as "ACTIVE" | "DISABLED" | "LOCKED"]
              }}
</el-tag>
</template>
</el-table-column><el-table-column label="最后登录" width="160">
<template #default="{ row = {} } = {}">
{{
            row.lastLoginAt
              ? dayjs(row.lastLoginAt).format("YYYY-MM-DD HH:mm")
              : "从未登录"
          }}
</template>
</el-table-column><el-table-column label="操作" width="130">
<template #default="{ row = {} } = {}">
<el-button
              v-if="hasPerms('user:update')"
              link
              type="primary"
              @click="edit(row as AdminUser)"
              >
编辑
</el-button><el-button
              v-if="hasPerms('user:disable')"
              link
              type="danger"
              @click="remove(row as AdminUser)"
              >
删除
</el-button>
</template>
</el-table-column>
</el-table>
    </div>
    <div v-if="!loadError && !loading" class="pagination-row">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @change="load"
      />
    </div>
    <el-dialog
      v-model="open"
      :title="editingId ? '编辑管理员' : '新增管理员'"
      width="min(620px,94vw)"
      >
<el-form label-position="top">
<div class="dialog-grid">
          <el-form-item label="用户名" required :error="validationAttempted && !form.username ? '请填写用户名' : undefined">
<el-input
              v-model="form.username"
              :disabled="Boolean(editingId)"
/>
</el-form-item><el-form-item label="显示名称">
<el-input v-model="form.displayName" />
</el-form-item><el-form-item label="邮箱" required class="span-2" :error="validationAttempted && !form.email ? '请填写邮箱' : undefined">
<el-input v-model="form.email" type="email" autocomplete="email" />
</el-form-item><el-form-item
            v-if="!editingId"
            label="初始密码"
            required
            class="span-2"
            :error="validationAttempted && form.password.length < 12 ? '初始密码至少需要 12 位' : undefined"
            >
<el-input
              v-model="form.password"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="至少 12 位，包含大小写字母和数字"
/>
</el-form-item><el-form-item label="账号状态">
<el-select v-model="form.status">
<el-option label="正常" value="ACTIVE" /><el-option
                label="停用"
                value="DISABLED"
/><el-option
                label="锁定"
                value="LOCKED"
/>
</el-select>
</el-form-item><el-form-item label="角色" required class="span-2" :error="validationAttempted && !form.roleIds.length ? '请选择至少一个角色' : undefined">
<el-checkbox-group v-model="form.roleIds" class="role-options">
<el-checkbox
                v-for="role in roles"
                :key="role.id"
                :value="role.id"
                :disabled="!role.isEnabled"
                >
{{ role.nameZh }} <small>{{ role.nameEn }}</small>
</el-checkbox>
</el-checkbox-group>
</el-form-item>
        </div>
</el-form><template #footer>
<el-button @click="open = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">
保存
</el-button>
</template>
</el-dialog>
  </div>
</template>
<style scoped>
.subline {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ops-muted);
}

.role-tag {
  margin: 2px 4px 2px 0;
}

.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.span-2 {
  grid-column: span 2;
}

.role-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.role-options small {
  color: var(--ops-muted);
}

.role-options :deep(.el-checkbox) {
  height: auto;
  min-height: 36px;
  margin-right: 0;
}

.role-options :deep(.el-checkbox__label) {
  overflow-wrap: anywhere;
  white-space: normal;
}

@media (width <= 620px) {
  .dialog-grid,
  .role-options {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
