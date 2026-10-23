<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";
import {
  deletePage,
  getPages,
  publishPage,
  restorePage,
  type ContentRecord
} from "@/api/content";
import { hasPerms } from "@/utils/auth";
import RequestError from "@/components/RequestError/index.vue";
import { getRequestErrorMessage } from "@/utils/http/error-message";

defineOptions({ name: "Pages" });
const router = useRouter();
const loading = ref(false);
const loadError = ref("");
const rows = ref<ContentRecord[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: "",
  deleted: "false"
});
const statusNames: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  OFFLINE: "已下线",
  ARCHIVED: "已归档"
};
async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await getPages(
      Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""))
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
function reset() {
  Object.assign(query, { page: 1, keyword: "", status: "", deleted: "false" });
  void load();
}
async function publish(row: ContentRecord) {
  await publishPage(row.id);
  ElMessage.success("页面已发布");
  await load();
}
async function remove(row: ContentRecord) {
  await ElMessageBox.confirm(`确认删除页面“${row.titleZh}”？`, "删除确认", {
    type: "warning"
  });
  await deletePage(row.id);
  ElMessage.success("页面已移入回收站");
  await load();
}
async function restore(row: ContentRecord) {
  await restorePage(row.id);
  ElMessage.success("页面已恢复为草稿");
  await load();
}
onMounted(load);
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>页面管理</h1>
        <p>管理单页内容、发布状态和搜索引擎信息</p>
      </div>
      <el-button
        v-if="hasPerms('content:manage')"
        type="primary"
        @click="router.push('/content/pages/create')"
        ><IconifyIconOnline icon="ri:add-line" />新增页面</el-button
      >
    </div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="搜索页面标题"
        style="width: 240px"
        @keyup.enter="
          query.page = 1;
          load();
        "
      /><el-select
        v-model="query.status"
        clearable
        placeholder="发布状态"
        style="width: 130px"
        ><el-option
          v-for="(label, key) in statusNames"
          :key="key"
          :label="label"
          :value="key" /></el-select
      ><el-select v-model="query.deleted" style="width: 120px"
        ><el-option label="正常页面" value="false" /><el-option
          label="回收站"
          value="true" /></el-select
      ><el-button
        type="primary"
        @click="
          query.page = 1;
          load();
        "
        >查询</el-button
      ><el-button @click="reset">重置</el-button>
    </div>
    <RequestError v-if="loadError" :message="loadError" @retry="load" />
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows"
        ><el-table-column label="页面" min-width="240"
          ><template #default="{ row }"
            ><strong>{{ row.titleZh }}</strong>
            <div class="subline">
              {{ row.titleEn }}
            </div></template
          ></el-table-column
        ><el-table-column label="状态" width="90"
          ><template #default="{ row }"
            ><el-tag
              :type="row.status === 'PUBLISHED' ? 'success' : 'info'"
              size="small"
              >{{ statusNames[row.status] }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column label="发布时间" width="150"
          ><template #default="{ row }">{{
            row.publishedAt
              ? dayjs(row.publishedAt).format("YYYY-MM-DD HH:mm")
              : "-"
          }}</template></el-table-column
        ><el-table-column label="更新时间" width="150"
          ><template #default="{ row }">{{
            dayjs(row.updatedAt).format("YYYY-MM-DD HH:mm")
          }}</template></el-table-column
        ><el-table-column label="操作" width="190" fixed="right"
          ><template #default="{ row }"
            ><template v-if="!row.deletedAt"
              ><el-button
                v-if="hasPerms('content:manage')"
                link
                type="primary"
                @click="router.push(`/content/pages/edit/${row.id}`)"
                >编辑</el-button
              ><el-button
                v-if="hasPerms('content:manage') && row.status !== 'PUBLISHED'"
                link
                @click="publish(row as ContentRecord)"
                >发布</el-button
              ><el-button
                v-if="hasPerms('content:manage')"
                link
                type="danger"
                @click="remove(row as ContentRecord)"
                >删除</el-button
              ></template
            ><el-button
              v-else-if="hasPerms('content:manage')"
              link
              type="success"
              @click="restore(row as ContentRecord)"
              >恢复</el-button
            ></template
          ></el-table-column
        ><template #empty><el-empty description="暂无页面" /></template
      ></el-table>
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
  margin-top: 4px;
  font-size: 12px;
  color: var(--ops-muted);
}
</style>
