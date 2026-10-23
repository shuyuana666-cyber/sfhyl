<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { getLoginLogs, type LogRecord } from "@/api/audit";

defineOptions({ name: "LoginLogs" });
const loading = ref(false);
const rows = ref<LogRecord[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  success: "",
  createdFrom: "",
  createdTo: ""
});
async function load() {
  loading.value = true;
  try {
    const result = await getLoginLogs(
      Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""))
    );
    rows.value = result.items;
    total.value = result.pagination.total;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>登录记录</h1>
        <p>管理员登录结果、来源地址和客户端信息</p>
      </div>
    </div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="账号 / IP / 失败原因"
        style="width: 250px"
        @keyup.enter="
          query.page = 1;
          load();
        "
      /><el-select
        v-model="query.success"
        clearable
        placeholder="登录结果"
        style="width: 130px"
        ><el-option label="成功" value="true" /><el-option
          label="失败"
          value="false" /></el-select
      ><el-date-picker
        v-model="query.createdFrom"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="开始日期"
      /><el-date-picker
        v-model="query.createdTo"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="结束日期"
      /><el-button
        type="primary"
        @click="
          query.page = 1;
          load();
        "
        >查询</el-button
      >
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows"
        ><el-table-column label="时间" width="165"
          ><template #default="{ row }">{{
            dayjs(row.createdAt).format("YYYY-MM-DD HH:mm:ss")
          }}</template></el-table-column
        ><el-table-column label="登录账号" min-width="170"
          ><template #default="{ row }"
            ><strong>{{ row.identifier }}</strong>
            <div class="subline">
              {{ row.adminUser?.displayName || row.adminUser?.username }}
            </div></template
          ></el-table-column
        ><el-table-column label="结果" width="90"
          ><template #default="{ row }"
            ><el-tag :type="row.success ? 'success' : 'danger'">{{
              row.success ? "成功" : "失败"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="失败原因" min-width="160"
          ><template #default="{ row }">{{
            row.failureCode || "-"
          }}</template></el-table-column
        ><el-table-column
          prop="ipAddress"
          label="IP 地址"
          width="150" /><el-table-column
          prop="userAgent"
          label="User-Agent"
          min-width="280"
          show-overflow-tooltip
      /></el-table>
    </div>
    <div class="pagination-row">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @change="load"
      />
    </div>
  </div>
</template>
<style scoped>
.subline {
  margin-top: 3px;
  font-size: 12px;
  color: var(--ops-muted);
}
</style>
