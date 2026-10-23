<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getMailStatus, type MailStatus } from "@/api/system";

defineOptions({ name: "MailSettings" });
const loading = ref(false);
const data = ref<MailStatus>();

onMounted(async () => {
  loading.value = true;
  try {
    data.value = await getMailStatus();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-loading="loading" class="admin-page">
    <div class="page-heading">
      <div><h1>邮件设置</h1></div>
      <el-tag :type="data?.enabled ? 'success' : 'info'">
        {{ data?.enabled ? "已启用" : "未启用" }}
      </el-tag>
    </div>
    <div class="data-panel system-detail">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="SMTP 主机">{{
          data?.host || "-"
        }}</el-descriptions-item>
        <el-descriptions-item label="端口">{{
          data?.port || "-"
        }}</el-descriptions-item>
        <el-descriptions-item label="加密连接">{{
          data?.secure ? "是" : "否"
        }}</el-descriptions-item>
        <el-descriptions-item label="用户名">{{
          data?.username || "-"
        }}</el-descriptions-item>
        <el-descriptions-item label="密码">
          <el-tag
            :type="data?.passwordConfigured ? 'success' : 'info'"
            size="small"
          >
            {{ data?.passwordConfigured ? "已配置" : "未配置" }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发件人">{{
          data?.fromName || "-"
        }}</el-descriptions-item>
        <el-descriptions-item label="发件地址">{{
          data?.fromAddress || "-"
        }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<style scoped>
.system-detail {
  max-width: 900px;
}
</style>
