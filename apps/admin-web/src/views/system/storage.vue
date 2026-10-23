<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getStorageStatus, type StorageStatus } from "@/api/system";

defineOptions({ name: "StorageSettings" });
const loading = ref(false);
const data = ref<StorageStatus>();

onMounted(async () => {
  loading.value = true;
  try {
    data.value = await getStorageStatus();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-loading="loading" class="admin-page">
    <div class="page-heading">
      <div><h1>文件存储</h1></div>
      <el-tag :type="data?.implementation === 'ready' ? 'success' : 'warning'">
        {{ data?.implementation === "ready" ? "已接入" : "适配器骨架" }}
      </el-tag>
    </div>
    <div class="data-panel system-detail">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="驱动">{{
          data?.driver
        }}</el-descriptions-item>
        <el-descriptions-item label="公开地址">{{
          data?.publicUrl || "-"
        }}</el-descriptions-item>
        <el-descriptions-item v-if="data?.path" label="存储目录">{{
          data.path
        }}</el-descriptions-item>
        <el-descriptions-item v-if="data?.endpoint" label="服务端点">
          {{ data.endpoint
          }}<template v-if="data.port">:{{ data.port }}</template>
        </el-descriptions-item>
        <el-descriptions-item v-if="data?.region" label="区域">{{
          data.region
        }}</el-descriptions-item>
        <el-descriptions-item v-if="data?.bucket" label="Bucket">{{
          data.bucket
        }}</el-descriptions-item>
        <el-descriptions-item
          v-if="data?.credentialsConfigured !== undefined"
          label="访问凭据"
        >
          <el-tag
            :type="data.credentialsConfigured ? 'success' : 'danger'"
            size="small"
          >
            {{ data.credentialsConfigured ? "已配置" : "未配置" }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<style scoped>
.system-detail {
  max-width: 900px;
}
</style>
