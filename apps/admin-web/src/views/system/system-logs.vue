<script setup lang="ts">
import { onMounted, ref } from "vue";
import dayjs from "dayjs";
import { getSystemLogs, type SystemLogEntry } from "@/api/system";

defineOptions({ name: "SystemLogs" });
const loading = ref(false);
const level = ref("");
const rows = ref<SystemLogEntry[]>([]);

function messageText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await getSystemLogs({
      limit: 200,
      level: level.value || undefined
    });
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div class="admin-page">
    <div class="page-heading">
      <div><h1>系统日志</h1></div>
      <el-button :loading="loading" circle title="刷新" @click="load">
        <IconifyIconOnline icon="ri:refresh-line" />
      </el-button>
    </div>
    <div class="filter-bar">
      <el-select
        v-model="level"
        clearable
        placeholder="日志级别"
        style="width: 150px"
        @change="load"
      >
        <el-option label="Debug" value="debug" />
        <el-option label="Info" value="log" />
        <el-option label="Warning" value="warn" />
        <el-option label="Error" value="error" />
        <el-option label="Fatal" value="fatal" />
      </el-select>
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows">
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{
            dayjs(row.timestamp).format("YYYY-MM-DD HH:mm:ss")
          }}</template>
        </el-table-column>
        <el-table-column label="级别" width="95">
          <template #default="{ row }"
            ><el-tag size="small">{{ row.level }}</el-tag></template
          >
        </el-table-column>
        <el-table-column
          prop="context"
          label="上下文"
          width="150"
          show-overflow-tooltip
        />
        <el-table-column label="内容" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">{{ messageText(row.message) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
