<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";
import echarts from "@/plugins/echarts";
import { getDashboard, type DashboardData } from "@/api/dashboard";

defineOptions({ name: "Dashboard" });

const loading = ref(false);
type DashboardRange = "7" | "30" | "90" | "custom";
const range = ref<DashboardRange>("30");
const customDates = ref<[string, string]>([
  dayjs().subtract(29, "day").format("YYYY-MM-DD"),
  dayjs().format("YYYY-MM-DD")
]);
const data = ref<DashboardData>();
const chartEl = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | undefined;

const metrics = computed(() => {
  const values = data.value?.summary || {};
  return [
    ["车辆总数", values.vehicleTotal],
    ["在售车辆", values.vehicleAvailable],
    ["已售车辆", values.vehicleSold],
    ["草稿车辆", values.vehicleDraft],
    ["新车", values.vehicleNew],
    ["二手车", values.vehicleUsed],
    ["今日询盘", values.inquiryToday],
    ["本周询盘", values.inquiryWeek],
    ["本月询盘", values.inquiryMonth],
    ["未处理询盘", values.inquiryUnhandled],
    ["图片素材", values.images],
    ["视频素材", values.videos]
  ];
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const params =
      range.value === "custom"
        ? {
            range: range.value,
            from: customDates.value[0],
            to: customDates.value[1]
          }
        : { range: range.value };
    data.value = await getDashboard(params);
    await nextTick();
    renderChart();
  } finally {
    loading.value = false;
  }
}

function renderChart(): void {
  if (!chartEl.value || !data.value) return;
  chart ||= echarts.init(chartEl.value);
  chart.setOption({
    color: ["#c72c35", "#21835b"],
    tooltip: { trigger: "axis" },
    legend: { right: 8, data: ["询盘", "发布车辆"] },
    grid: { top: 42, left: 44, right: 18, bottom: 34 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.value.inquiryTrend.map(item => item.date.slice(5)),
      axisLine: { lineStyle: { color: "#d9dde2" } }
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#eef0f2" } }
    },
    series: [
      {
        name: "询盘",
        type: "line",
        smooth: true,
        symbol: "none",
        areaStyle: { opacity: 0.08 },
        data: data.value.inquiryTrend.map(item => item.count)
      },
      {
        name: "发布车辆",
        type: "line",
        smooth: true,
        symbol: "none",
        data: data.value.vehicleTrend.map(item => item.count)
      }
    ]
  });
}

function resize(): void {
  chart?.resize();
}
function changeRange(): void {
  if (range.value !== "custom") void load();
  else void applyCustomDates();
}
function applyCustomDates(): void {
  const [from, to] = customDates.value || [];
  if (!from || !to) return;
  if (dayjs(to).diff(dayjs(from), "day") > 366) {
    ElMessage.warning("统计时间范围不能超过 366 天");
    return;
  }
  void load();
}
onMounted(() => {
  void load();
  window.addEventListener("resize", resize);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  chart?.dispose();
});
</script>

<template>
  <div v-loading="loading" class="admin-page">
    <div class="page-heading">
      <div>
        <h1>数据概览</h1>
        <p>{{ dayjs().format("YYYY年MM月DD日 dddd") }}</p>
      </div>
      <div class="dashboard-range">
        <el-segmented
          v-model="range"
          :options="[
            { label: '7天', value: '7' },
            { label: '30天', value: '30' },
            { label: '90天', value: '90' },
            { label: '自定义', value: 'custom' }
          ]"
          @change="changeRange"
        />
        <el-date-picker
          v-if="range === 'custom'"
          v-model="customDates"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          unlink-panels
          @change="applyCustomDates"
        />
      </div>
    </div>
    <section class="metric-grid">
      <div v-for="metric in metrics" :key="metric[0]" class="metric-tile">
        <div class="metric-tile__label">{{ metric[0] }}</div>
        <div class="metric-tile__value">{{ metric[1] ?? 0 }}</div>
      </div>
    </section>
    <section class="split-grid">
      <div class="data-panel">
        <h2>业务趋势</h2>
        <div ref="chartEl" class="chart" />
      </div>
      <div class="data-panel">
        <h2>热门车辆</h2>
        <el-table :data="data?.topVehicles || []" size="small" max-height="300">
          <el-table-column prop="stockNo" label="库存号" width="110" />
          <el-table-column prop="nameZh" label="车辆" show-overflow-tooltip />
          <el-table-column label="询盘" width="64" align="right"
            ><template #default="{ row }">{{
              row._count?.inquiries || 0
            }}</template></el-table-column
          >
        </el-table>
      </div>
    </section>
    <section class="split-grid">
      <div class="data-panel">
        <h2>最近操作</h2>
        <el-table
          :data="data?.recentAudits || []"
          size="small"
          max-height="280"
        >
          <el-table-column prop="actorName" label="管理员" width="120" />
          <el-table-column prop="action" label="操作" width="100" />
          <el-table-column prop="summary" label="内容" show-overflow-tooltip />
          <el-table-column label="时间" width="150"
            ><template #default="{ row }">{{
              dayjs(row.createdAt).format("MM-DD HH:mm")
            }}</template></el-table-column
          >
        </el-table>
      </div>
      <div class="data-panel">
        <h2>最近登录</h2>
        <el-table
          :data="data?.recentLogins || []"
          size="small"
          max-height="280"
        >
          <el-table-column
            prop="identifier"
            label="账号"
            show-overflow-tooltip
          />
          <el-table-column prop="ipAddress" label="IP" width="125" />
          <el-table-column label="结果" width="70"
            ><template #default="{ row }"
              ><el-tag
                size="small"
                :type="row.success ? 'success' : 'danger'"
                >{{ row.success ? "成功" : "失败" }}</el-tag
              ></template
            ></el-table-column
          >
        </el-table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard-range {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

@media (width <= 760px) {
  .dashboard-range {
    justify-content: flex-start;
    width: 100%;
  }
}
</style>
