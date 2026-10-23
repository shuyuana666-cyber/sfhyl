<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { getAuditLogs, type LogRecord } from "@/api/audit";

defineOptions({ name: "AuditLogs" });
const loading = ref(false);
const rows = ref<LogRecord[]>([]);
const total = ref(0);
const detail = ref<LogRecord | null>(null);
const drawer = ref(false);
const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  action: "",
  resourceType: "",
  createdFrom: "",
  createdTo: ""
});
async function load() {
  loading.value = true;
  try {
    const result = await getAuditLogs(
      Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""))
    );
    rows.value = result.items;
    total.value = result.pagination.total;
  } finally {
    loading.value = false;
  }
}
function open(row: LogRecord) {
  detail.value = row;
  drawer.value = true;
}
onMounted(load);
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>操作日志</h1>
        <p>关键后台变更的只读审计记录</p>
      </div>
    </div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="管理员 / 描述 / 对象 ID"
        style="width: 250px"
        @keyup.enter="
          query.page = 1;
          load();
        "
      /><el-input
        v-model="query.action"
        clearable
        placeholder="操作类型"
        style="width: 140px"
      /><el-input
        v-model="query.resourceType"
        clearable
        placeholder="业务模块"
        style="width: 150px"
      /><el-date-picker
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
        ><el-table-column label="时间" width="160"
          ><template #default="{ row }">{{
            dayjs(row.createdAt).format("YYYY-MM-DD HH:mm:ss")
          }}</template></el-table-column
        ><el-table-column label="管理员" width="140"
          ><template #default="{ row }">{{
            row.actorName ||
            row.adminUser?.displayName ||
            row.adminUser?.username ||
            "-"
          }}</template></el-table-column
        ><el-table-column
          prop="action"
          label="操作"
          width="130"
        /><el-table-column
          prop="resourceType"
          label="对象类型"
          width="150"
        /><el-table-column
          prop="summary"
          label="说明"
          min-width="240"
          show-overflow-tooltip
        /><el-table-column label="结果" width="80"
          ><template #default="{ row }"
            ><el-tag
              :type="row.success === false ? 'danger' : 'success'"
              size="small"
              >{{ row.success === false ? "失败" : "成功" }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column
          prop="ipAddress"
          label="IP"
          width="140"
        /><el-table-column label="耗时" width="90"
          ><template #default="{ row }"
            >{{ row.durationMs ?? "-" }} ms</template
          ></el-table-column
        ><el-table-column label="操作" width="80" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="open(row as LogRecord)"
              >详情</el-button
            ></template
          ></el-table-column
        ></el-table
      >
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
    <el-drawer v-model="drawer" title="操作日志详情" size="min(680px,96vw)"
      ><el-descriptions v-if="detail" :column="1" border
        ><el-descriptions-item label="请求"
          >{{ detail.requestMethod }}
          {{ detail.requestPath }}</el-descriptions-item
        ><el-descriptions-item label="对象"
          >{{ detail.resourceType }} #{{
            detail.resourceId || "-"
          }}</el-descriptions-item
        ><el-descriptions-item label="User-Agent">{{
          detail.userAgent || "-"
        }}</el-descriptions-item
        ><el-descriptions-item label="错误">{{
          detail.errorMessage || "-"
        }}</el-descriptions-item></el-descriptions
      >
      <section v-if="detail?.beforeData">
        <h3>修改前</h3>
        <pre>{{ JSON.stringify(detail.beforeData, null, 2) }}</pre>
      </section>
      <section v-if="detail?.afterData">
        <h3>修改后</h3>
        <pre>{{ JSON.stringify(detail.afterData, null, 2) }}</pre>
      </section></el-drawer
    >
  </div>
</template>
<style scoped>
section {
  margin-top: 18px;
}

section h3 {
  font-size: 14px;
}

pre {
  max-height: 340px;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  color: #d8dee9;
  white-space: pre-wrap;
  background: #20252b;
  border-radius: 5px;
}
</style>
