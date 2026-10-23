<script setup lang="ts">
import { formatBytes } from "@/utils/format-bytes";
import { computed, onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { clearMediaUploads, getMediaUploads } from "@/api/media";
import { ElMessage, ElMessageBox } from "element-plus";
import { hasPerms } from "@/utils/auth";
import RequestError from "@/components/RequestError/index.vue";
import type { MediaUploadRecord } from "@/types/business";
import { getRequestErrorMessage } from "@/utils/http/error-message";
import { resolveMediaUrl } from "@/utils/media";

defineOptions({ name: "MediaUploads" });

const loading = ref(false);
const clearing = ref(false);
const loadError = ref("");
const rows = ref<MediaUploadRecord[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: "",
  createdFrom: "",
  createdTo: ""
});
const hasFilters = computed(() =>
  Boolean(query.keyword || query.status || query.createdFrom || query.createdTo)
);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await getMediaUploads(
      Object.fromEntries(
        Object.entries(query).filter(([, value]) => value !== "")
      )
    );
    rows.value = result.items;
    total.value = result.pagination.total;
  } catch (error) {
    rows.value = [];
    total.value = 0;
    loadError.value = getRequestErrorMessage(error);
  } finally {
    loading.value = false;
  }
}

function search(): void {
  query.page = 1;
  void load();
}

function reset(): void {
  Object.assign(query, {
    page: 1,
    pageSize: 20,
    keyword: "",
    status: "",
    createdFrom: "",
    createdTo: ""
  });
  void load();
}

const formatSize = formatBytes;

async function clearAll(): Promise<void> {
  await ElMessageBox.confirm("确认清空全部上传记录？此操作仅清除记录，已上传的素材保持保留。", "清空上传记录", {
    type: "warning", confirmButtonText: "全部清空", cancelButtonText: "取消"
  });
  clearing.value = true;
  try {
    const result = await clearMediaUploads();
    ElMessage.success(`已清空 ${result.affected} 条上传记录`);
    Object.assign(query, { page: 1, keyword: "", status: "", createdFrom: "", createdTo: "" });
    await load();
  } finally {
    clearing.value = false;
  }
}

function duration(durationMs?: number | null): string {
  if (durationMs == null) return "-";
  return durationMs < 1000
    ? `${durationMs} ms`
    : `${(durationMs / 1000).toFixed(1)} s`;
}

onMounted(() => void load());
</script>

<template>
  <div class="admin-page media-uploads-page">
    <div class="page-heading">
      <div>
        <h1>上传记录</h1>
        <p>查看每个文件的处理结果、上传人、耗时和失败原因</p>
      </div>
      <el-button v-if="hasPerms('media:delete')" type="danger" plain :loading="clearing" :disabled="loading" @click="clearAll">
        <IconifyIconOnline icon="ri:delete-bin-line" />全部清空
      </el-button>
    </div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="文件名称"
        style="width: 260px"
        @keyup.enter="search"
      />
      <el-select
        v-model="query.status"
        clearable
        placeholder="状态"
        style="width: 130px"
      >
        <el-option label="处理中" value="PROCESSING" />
        <el-option label="成功" value="SUCCEEDED" />
        <el-option label="失败" value="FAILED" />
      </el-select>
      <el-date-picker
        v-model="query.createdFrom"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="开始日期"
      />
      <el-date-picker
        v-model="query.createdTo"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="结束日期"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button :disabled="!hasFilters" @click="reset">重置</el-button>
    </div>
    <RequestError v-if="loadError" :message="loadError" @retry="load" />
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows">
        <el-table-column label="文件" min-width="240">
          <template #default="{ row = {} } = {}">
            <a
              v-if="row.mediaAsset?.url"
              :href="resolveMediaUrl(row.mediaAsset.url)"
              target="_blank"
              rel="noopener"
              class="file-link"
              >{{ row.originalName }}</a
            >
            <strong v-else>{{ row.originalName }}</strong>
            <div class="subline">
              {{ row.mimeType || "-" }} · {{ formatSize(row.sizeBytes) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row = {} } = {}">
            <el-tag
              :type="
                row.status === 'SUCCEEDED'
                  ? 'success'
                  : row.status === 'FAILED'
                    ? 'danger'
                    : 'warning'
              "
            >
              {{
                row.status === "SUCCEEDED"
                  ? "成功"
                  : row.status === "FAILED"
                    ? "失败"
                    : "处理中"
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上传人" width="150">
          <template #default="{ row = {} } = {}">
            {{ row.createdBy?.displayName || row.createdBy?.username || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="100">
          <template #default="{ row = {} } = {}">{{ duration(row.durationMs) }}</template>
        </el-table-column>
        <el-table-column label="失败原因" min-width="240">
          <template #default="{ row = {} } = {}">
            <span class="error-message">{{ row.errorMessage || "-" }}</span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="170">
          <template #default="{ row = {} } = {}">{{
            dayjs(row.createdAt).format("YYYY-MM-DD HH:mm:ss")
          }}</template>
        </el-table-column>
        <template #empty><el-empty description="暂无上传记录" /></template>
      </el-table>
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
.subline,
.error-message {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: var(--ops-muted);
  overflow-wrap: anywhere;
}

.file-link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.file-link:hover {
  text-decoration: underline;
}
</style>
