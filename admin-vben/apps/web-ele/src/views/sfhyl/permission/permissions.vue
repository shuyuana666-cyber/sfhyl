<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { getPermissions, type Permission } from "@/api/roles";
import PageLoadState from "@/components/PageLoadState/index.vue";
import { usePageLoad } from "@/composables/usePageLoad";

defineOptions({ name: "PermissionList" });

const { loading, loadError, runLoad } = usePageLoad();
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

async function load() {
  await runLoad(async () => {
    rows.value = await getPermissions();
  });
}
onMounted(load);
</script>

<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>权限列表</h1>
        <p>{{ rows.length }} 个权限码</p>
      </div>
    </div>
    <PageLoadState :loading="loading" :error="loadError" :ready="rows.length > 0" @retry="load" />
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="权限码 / 名称 / 模块"
        aria-label="权限码 / 名称 / 模块"
        style="width: 280px"
      />
    </div>
    <div v-show="!loadError && (!loading || rows.length > 0)" class="table-wrap">
      <el-table v-loading="loading" :data="filtered" row-key="id" empty-text="没有匹配的权限">
        <el-table-column prop="module" label="模块" width="130" />
        <el-table-column prop="code" label="权限码" min-width="210" />
        <el-table-column prop="nameZh" label="中文名称" min-width="180" />
        <el-table-column prop="nameEn" label="英文名称" min-width="220" />
      </el-table>
    </div>
  </div>
</template>
