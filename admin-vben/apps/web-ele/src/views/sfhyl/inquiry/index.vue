<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";
import {
  addInquiryNote,
  archiveInquiry,
  assignInquiry,
  batchInquiryAssign,
  batchInquiryStatus,
  exportInquiries,
  getInquiries,
  getInquiryAssignees,
  getInquiry,
  updateInquiry,
  type Inquiry,
  type InquiryAssignee
} from "@/api/inquiries";
import { hasPerms } from "@/utils/auth";
import RequestError from "@/components/RequestError/index.vue";
import { getRequestErrorMessage } from "@/utils/http/error-message";

defineOptions({ name: "Inquiries" });
const route = useRoute();
const loading = ref(false);
const loadError = ref("");
const detailLoading = ref(false);
const rows = ref<Inquiry[]>([]);
const users = ref<InquiryAssignee[]>([]);
const selected = ref<Inquiry[]>([]);
const total = ref(0);
const drawer = ref(false);
const detail = ref<Inquiry | null>(null);
const note = ref("");
const assigneeId = ref("");
const batchStatusValue = ref("");
const batchAssignee = ref("");
const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: "",
  source: "",
  assigneeId: "",
  createdFrom: "",
  createdTo: ""
});
const pageTitle = computed(() => route.meta.title || "客户询盘");
const statusMap: Record<
  string,
  [string, "danger" | "warning" | "success" | "info" | "primary"]
> = {
  NEW: ["新询盘", "danger"],
  CONTACTED: ["已联系", "primary"],
  FOLLOWING: ["跟进中", "warning"],
  QUOTED: ["已报价", "primary"],
  WON: ["已成交", "success"],
  LOST: ["已流失", "info"],
  INVALID: ["无效", "info"]
};
async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await getInquiries(
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
function applyRoutePreset(): void {
  Object.assign(query, {
    page: 1,
    pageSize: 20,
    keyword: "",
    status: "",
    source: "",
    assigneeId: "",
    createdFrom: "",
    createdTo: ""
  });
  Object.assign(query, route.meta.inquiryPreset || {});
}
function reset(): void {
  applyRoutePreset();
  void load();
}
async function openDetail(row: Inquiry) {
  drawer.value = true;
  detailLoading.value = true;
  try {
    detail.value = await getInquiry(row.id);
    assigneeId.value =
      detail.value.assignments?.find(
        (item: Record<string, unknown>) => !item.endedAt
      )?.assignedToId || "";
  } finally {
    detailLoading.value = false;
  }
}
async function changeStatus(id: string, status: string) {
  await updateInquiry(id, { status });
  ElMessage.success("询盘状态已更新");
  if (detail.value?.id === id) detail.value = await getInquiry(id);
  await load();
}
async function addNote() {
  if (!detail.value || !note.value.trim()) {
    ElMessage.warning("请输入备注内容");
    return;
  }
  await addInquiryNote(detail.value.id, note.value.trim());
  note.value = "";
  detail.value = await getInquiry(detail.value.id);
  ElMessage.success("备注已添加");
}
async function assign() {
  if (!detail.value || !assigneeId.value) {
    ElMessage.warning("请选择负责人");
    return;
  }
  await assignInquiry(detail.value.id, assigneeId.value);
  detail.value = await getInquiry(detail.value.id);
  await load();
  ElMessage.success("负责人已更新");
}
async function runBatchStatus() {
  if (!selected.value.length || !batchStatusValue.value) {
    ElMessage.warning("请选择询盘和目标状态");
    return;
  }
  await batchInquiryStatus(
    selected.value.map(item => item.id),
    batchStatusValue.value
  );
  ElMessage.success("批量状态已更新");
  await load();
}
async function runBatchAssign() {
  if (!selected.value.length || !batchAssignee.value) {
    ElMessage.warning("请选择询盘和负责人");
    return;
  }
  await batchInquiryAssign(
    selected.value.map(item => item.id),
    batchAssignee.value
  );
  ElMessage.success("批量分配完成");
  await load();
}
async function archive(row: Inquiry) {
  await ElMessageBox.confirm(`确认归档 ${row.name} 的询盘？`, "归档询盘", {
    type: "warning"
  });
  await archiveInquiry(row.id);
  await load();
}
watch(
  () => route.name,
  () => {
    applyRoutePreset();
    void load();
  }
);
onMounted(async () => {
  applyRoutePreset();
  const [assignees] = await Promise.all([getInquiryAssignees(), load()]);
  users.value = assignees;
});
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>{{ pageTitle }}</h1>
        <p>集中处理官网询价、联系留言和跟进记录</p>
      </div>
      <el-button
        v-if="hasPerms('inquiry:export')"
        @click="exportInquiries(query)"
        ><IconifyIconOnline icon="ri:download-2-line" />导出 CSV</el-button
      >
    </div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        placeholder="姓名 / 电话 / 邮箱 / 公司"
        style="width: 250px"
        @keyup.enter="
          query.page = 1;
          load();
        "
      /><el-select
        v-model="query.status"
        clearable
        placeholder="状态"
        style="width: 130px"
        ><el-option
          v-for="(item, key) in statusMap"
          :key="key"
          :label="item[0]"
          :value="key" /></el-select
      ><el-select
        v-model="query.source"
        clearable
        placeholder="来源"
        style="width: 140px"
        ><el-option label="官网" value="WEBSITE" /><el-option
          label="WhatsApp"
          value="WHATSAPP" /><el-option
          label="手工录入"
          value="MANUAL" /><el-option label="其他" value="OTHER" /></el-select
      ><el-select
        v-model="query.assigneeId"
        clearable
        placeholder="负责人"
        style="width: 150px"
        ><el-option
          v-for="user in users"
          :key="user.id"
          :label="user.displayName || user.username"
          :value="user.id" /></el-select
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
      ><el-button @click="reset">重置</el-button>
    </div>
    <RequestError v-if="loadError" :message="loadError" @retry="load" />
    <div class="action-bar">
      <div class="batch-controls">
        <template v-if="hasPerms('inquiry:update')">
          <el-select
            v-model="batchStatusValue"
            placeholder="批量改状态"
            style="width: 140px"
            ><el-option
              v-for="(item, key) in statusMap"
              :key="key"
              :label="item[0]"
              :value="key" /></el-select
          ><el-button @click="runBatchStatus">应用</el-button>
        </template>
        <template v-if="hasPerms('inquiry:assign')">
          <el-select
            v-model="batchAssignee"
            placeholder="批量分配"
            style="width: 150px"
            ><el-option
              v-for="user in users"
              :key="user.id"
              :label="user.displayName || user.username"
              :value="user.id" /></el-select
          ><el-button @click="runBatchAssign">分配</el-button>
        </template>
      </div>
      <span>已选 {{ selected.length }} 项</span>
    </div>
    <div class="table-wrap">
      <el-table
        v-loading="loading"
        :data="rows"
        @selection-change="selected = $event"
        ><el-table-column type="selection" width="46" /><el-table-column
          label="客户"
          min-width="180"
          ><template #default="{ row = {} } = {}"
            ><strong>{{ row.name }}</strong>
            <div class="subline">
              {{ row.companyName || row.country || "-" }}
            </div></template
          ></el-table-column
        ><el-table-column label="联系方式" min-width="190"
          ><template #default="{ row = {} } = {}"
            ><div>{{ row.whatsapp || row.phone || "-" }}</div>
            <div class="subline">{{ row.email }}</div></template
          ></el-table-column
        ><el-table-column label="意向车辆" min-width="180"
          ><template #default="{ row = {} } = {}"
            >{{ row.vehicle?.nameZh || "通用咨询" }}
            <div class="subline">{{ row.vehicle?.stockNo }}</div></template
          ></el-table-column
        ><el-table-column label="状态" width="110"
          ><template #default="{ row = {} } = {}"
            ><el-dropdown
              v-if="hasPerms('inquiry:update')"
              @command="value => changeStatus(row.id, value)"
              ><el-tag
                :type="statusMap[row.status]?.[1]"
                style="cursor: pointer"
                >{{ statusMap[row.status]?.[0] }}</el-tag
              ><template #dropdown
                ><el-dropdown-menu
                  ><el-dropdown-item
                    v-for="(item, key) in statusMap"
                    :key="key"
                    :command="key"
                    >{{ item[0] }}</el-dropdown-item
                  ></el-dropdown-menu
                ></template
              ></el-dropdown
            >
            <el-tag v-else :type="statusMap[row.status]?.[1]">{{
              statusMap[row.status]?.[0]
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="负责人" width="120"
          ><template #default="{ row = {} } = {}">{{
            row.assignments?.[0]?.assignedTo?.displayName ||
            row.assignments?.[0]?.assignedTo?.username ||
            "未分配"
          }}</template></el-table-column
        ><el-table-column label="提交时间" width="150"
          ><template #default="{ row = {} } = {}">{{
            dayjs(row.createdAt).format("YYYY-MM-DD HH:mm")
          }}</template></el-table-column
        ><el-table-column label="操作" width="130" fixed="right"
          ><template #default="{ row = {} } = {}"
            ><el-button link type="primary" @click="openDetail(row as Inquiry)"
              >查看</el-button
            ><el-button
              v-if="hasPerms('inquiry:update')"
              link
              type="danger"
              @click="archive(row as Inquiry)"
              >归档</el-button
            ></template
          ></el-table-column
        ><template #empty><el-empty description="暂无询盘" /></template
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
    <el-drawer v-model="drawer" title="询盘详情" size="min(720px,96vw)"
      ><div v-if="detail" v-loading="detailLoading" class="inquiry-detail">
        <div class="detail-head">
          <div>
            <h2>{{ detail.name }}</h2>
            <span
              >#{{ detail.id }} ·
              {{ dayjs(detail.createdAt).format("YYYY-MM-DD HH:mm") }}</span
            >
          </div>
          <el-tag :type="statusMap[detail.status]?.[1]">{{
            statusMap[detail.status]?.[0]
          }}</el-tag>
        </div>
        <el-descriptions :column="2" border
          ><el-descriptions-item label="国家/地区">{{
            detail.country || "-"
          }}</el-descriptions-item
          ><el-descriptions-item label="公司">{{
            detail.companyName || "-"
          }}</el-descriptions-item
          ><el-descriptions-item label="电话">{{
            detail.phone || "-"
          }}</el-descriptions-item
          ><el-descriptions-item label="WhatsApp">{{
            detail.whatsapp || "-"
          }}</el-descriptions-item
          ><el-descriptions-item label="邮箱" :span="2">{{
            detail.email || "-"
          }}</el-descriptions-item
          ><el-descriptions-item label="来源"
            >{{ detail.source }} /
            {{ detail.sourcePage || "-" }}</el-descriptions-item
          ><el-descriptions-item label="IP">{{
            detail.clientIp || "-"
          }}</el-descriptions-item></el-descriptions
        >
        <section v-if="hasPerms('inquiry:assign')">
          <h3>客户留言</h3>
          <p class="message">{{ detail.message }}</p>
        </section>
        <section>
          <h3>负责人</h3>
          <div class="assign-row">
            <el-select v-model="assigneeId" filterable
              ><el-option
                v-for="user in users"
                :key="user.id"
                :label="user.displayName || user.username"
                :value="user.id" /></el-select
            ><el-button type="primary" @click="assign">确认分配</el-button>
          </div>
        </section>
        <section>
          <h3>内部备注</h3>
          <template v-if="hasPerms('inquiry:note')">
            <el-input
              v-model="note"
              type="textarea"
              :rows="3"
              placeholder="记录沟通结果和后续安排"
            /><el-button class="note-button" type="primary" @click="addNote"
              >添加备注</el-button
            >
          </template>
          <el-timeline class="note-timeline"
            ><el-timeline-item
              v-for="item in detail.notes"
              :key="item.id"
              :timestamp="dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')"
              placement="top"
              ><strong>{{
                item.author?.displayName || item.author?.username
              }}</strong>
              <p>{{ item.content }}</p></el-timeline-item
            ></el-timeline
          >
        </section>
        <section>
          <h3>分配记录</h3>
          <el-timeline
            ><el-timeline-item
              v-for="item in detail.assignments"
              :key="item.id"
              :timestamp="dayjs(item.assignedAt).format('YYYY-MM-DD HH:mm')"
              ><span
                >{{ item.assignedBy?.displayName || item.assignedBy?.username }}
                分配给
                {{
                  item.assignedTo?.displayName || item.assignedTo?.username
                }}</span
              ></el-timeline-item
            ></el-timeline
          >
        </section>
      </div></el-drawer
    >
  </div>
</template>
<style scoped>
.batch-controls,
.assign-row {
  display: flex;
  gap: 8px;
}

.subline {
  margin-top: 3px;
  font-size: 12px;
  color: var(--ops-muted);
}

.inquiry-detail section {
  padding: 18px 0;
  border-top: 1px solid var(--ops-line);
}

.inquiry-detail h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.detail-head h2 {
  margin: 0;
  font-size: 20px;
}

.detail-head span {
  font-size: 12px;
  color: var(--ops-muted);
}

.message {
  padding: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  background: #f7f8f9;
  border-left: 3px solid var(--ops-accent);
}

.assign-row .el-select {
  flex: 1;
}

.note-button {
  margin-top: 8px;
}

.note-timeline {
  margin-top: 20px;
}

.note-timeline p {
  margin: 5px 0;
  white-space: pre-wrap;
}
</style>
