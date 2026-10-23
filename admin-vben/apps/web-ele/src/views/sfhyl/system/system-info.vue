<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { getSystemInfo, type SystemInfo } from "@/api/system";
import PageLoadState from "@/components/PageLoadState/index.vue";
import { usePageLoad } from "@/composables/usePageLoad";

defineOptions({ name: "SystemInfo" });
const { loading, loadError, runLoad } = usePageLoad();
const data = ref<SystemInfo>({});
const rows = computed(() =>
  Object.entries(data.value).map(([key, value]) => ({
    key,
    value: typeof value === "object" ? JSON.stringify(value) : String(value)
  }))
);

async function load() {
  await runLoad(async () => {
    data.value = await getSystemInfo();
  });
}
onMounted(load);
</script>

<template>
  <div class="admin-page">
    <div class="page-heading">
      <div><h1>系统信息</h1></div>
    </div>
    <PageLoadState :loading="loading" :error="loadError" :ready="rows.length > 0" @retry="load" />
    <div v-show="!loadError && (!loading || rows.length > 0)" class="table-wrap system-info-table">
      <el-table v-loading="loading" :data="rows" :show-header="false">
        <el-table-column prop="key" width="220" />
        <el-table-column prop="value" min-width="360" />
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.system-info-table {
  max-width: 900px;
}
</style>
