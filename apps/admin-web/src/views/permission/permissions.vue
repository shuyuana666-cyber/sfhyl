<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getPermissions, type Permission } from "@/api/roles";

defineOptions({ name: "PermissionList" });

const loading = ref(false);
const keyword = ref("");
const rows = ref<Permission[]>([]);
const filtered = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) return rows.value;
  return rows.value.filter(item =>
    [item.code, item.nameZh, item.nameEn, item.module]
      .filter(Boolean)
      .some(text => String(text).toLowerCase().includes(value))
  );
});

onMounted(async () => {
  loading.value = true;
  try {
    rows.value = await getPermissions();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>权限列表</h1>
        <p>{{ rows.length }} 个权限码</p>
      </div>
    </div>
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="权限码 / 名称 / 模块"
        style="width: 280px"
      />
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="filtered" row-key="id">
        <el-table-column prop="module" label="模块" width="130" />
        <el-table-column prop="code" label="权限码" min-width="210" />
        <el-table-column prop="nameZh" label="中文名称" min-width="180" />
        <el-table-column prop="nameEn" label="英文名称" min-width="220" />
      </el-table>
    </div>
  </div>
</template>
