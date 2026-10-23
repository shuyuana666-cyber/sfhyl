<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import RequestError from "@/components/RequestError/index.vue";
import { getInquiryNotes, type InquiryNoteRecord } from "@/api/inquiries";
import { getRequestErrorMessage } from "@/utils/http/error-message";

defineOptions({ name: "InquiryNotes" });

const loading = ref(false);
const loadError = ref("");
const rows = ref<InquiryNoteRecord[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  createdFrom: "",
  createdTo: ""
});
const hasFilters = computed(() =>
  Boolean(query.keyword || query.createdFrom || query.createdTo)
);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await getInquiryNotes(
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
    createdFrom: "",
    createdTo: ""
  });
  void load();
}

onMounted(() => void load());
</script>

<template>
  <div class="admin-page inquiry-notes-page">
    <div class="page-heading">
      <div>
        <h1>客户备注</h1>
        <p>跨询盘查看内部沟通记录和后续安排</p>
      </div>
    </div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="客户、公司或备注内容"
        style="width: 280px"
        @keyup.enter="search"
      />
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
        <el-table-column label="客户" min-width="180">
          <template #default="{ row }">
            <strong>{{ row.inquiry.name }}</strong>
            <div class="subline">
              #{{ row.inquiry.id }} {{ row.inquiry.companyName || "" }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="意向车辆" min-width="180">
          <template #default="{ row }">
            {{ row.inquiry.vehicle?.nameZh || "通用咨询" }}
            <div class="subline">{{ row.inquiry.vehicle?.stockNo }}</div>
          </template>
        </el-table-column>
        <el-table-column label="内部备注" min-width="320">
          <template #default="{ row }">
            <span class="note-content">{{ row.content }}</span>
          </template>
        </el-table-column>
        <el-table-column label="记录人" width="150">
          <template #default="{ row }">
            {{ row.author?.displayName || row.author?.username || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="记录时间" width="170">
          <template #default="{ row }">
            {{ dayjs(row.createdAt).format("YYYY-MM-DD HH:mm") }}
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无客户备注" /></template>
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
.subline {
  margin-top: 3px;
  font-size: 12px;
  color: var(--ops-muted);
}

.note-content {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
