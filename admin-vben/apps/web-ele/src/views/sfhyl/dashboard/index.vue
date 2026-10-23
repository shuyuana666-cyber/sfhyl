<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { type DashboardData, getDashboard } from '@/api/dashboard';
import RequestError from '@/components/RequestError/index.vue';
import echarts from '@/plugins/echarts';
import { getRequestErrorMessage } from '@/utils/http/error-message';
import { useResizeObserver } from '@vueuse/core';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

defineOptions({ name: 'Dashboard' });

const loading = ref(false);
const loadError = ref('');
type DashboardRange = '7' | '30' | '90' | 'custom';
const range = ref<DashboardRange>('30');
const customDates = ref<[string, string]>([
  dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD'),
]);
const data = ref<DashboardData>();
const chartEl = ref<HTMLDivElement>();
let chart: ReturnType<typeof echarts.init> | undefined;

const metrics = computed(() => {
  const values = data.value?.summary || {};
  return [
    ['车辆总数', values.vehicleTotal],
    ['在售车辆', values.vehicleAvailable],
    ['已售车辆', values.vehicleSold],
    ['草稿车辆', values.vehicleDraft],
    ['新车', values.vehicleNew],
    ['二手车', values.vehicleUsed],
    ['今日询盘', values.inquiryToday],
    ['本周询盘', values.inquiryWeek],
    ['本月询盘', values.inquiryMonth],
    ['未处理询盘', values.inquiryUnhandled],
    ['图片素材', values.images],
    ['视频素材', values.videos],
  ];
});

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    const params =
      range.value === 'custom'
        ? {
            range: range.value,
            from: customDates.value[0],
            to: customDates.value[1],
          }
        : { range: range.value };
    data.value = await getDashboard(params);
    await nextTick();
    renderChart();
  } catch (error) {
    loadError.value = getRequestErrorMessage(error);
  } finally {
    loading.value = false;
  }
}

function renderChart(): void {
  if (!chartEl.value?.clientWidth || !chartEl.value.clientHeight || !data.value) return;
  chart ||= echarts.init(chartEl.value);
  chart.setOption({
    color: ['#bd3b0b', '#526071'],
    animationDuration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
    tooltip: { trigger: 'axis' },
    legend: { right: 8, data: ['询盘', '发布车辆'] },
    grid: { top: 42, left: 44, right: 18, bottom: 34 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.value.inquiryTrend.map((item) => item.date.slice(5)),
      axisLine: { lineStyle: { color: '#d9dde2' } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#eef0f2' } },
    },
    series: [
      {
        name: '询盘',
        type: 'line',
        smooth: true,
        symbol: 'none',
        areaStyle: { opacity: 0.08 },
        data: data.value.inquiryTrend.map((item) => item.count),
      },
      {
        name: '发布车辆',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: data.value.vehicleTrend.map((item) => item.count),
      },
    ],
  });
}

function resize(): void {
  if (!chartEl.value?.clientWidth || !chartEl.value.clientHeight) return;
  if (chart) chart.resize();
  else renderChart();
}
useResizeObserver(chartEl, resize);
function changeRange(): void {
  if (range.value !== 'custom') void load();
  else void applyCustomDates();
}
function applyCustomDates(): void {
  const [from, to] = customDates.value || [];
  if (!from || !to) return;
  if (dayjs(to).diff(dayjs(from), 'day') > 366) {
    ElMessage.warning('统计时间范围不能超过 366 天');
    return;
  }
  void load();
}
onMounted(() => {
  void load();
  window.addEventListener('resize', resize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
});
</script>

<template>
  <div v-loading="loading" class="admin-page">
    <div class="page-heading">
      <div>
        <h1>数据概览</h1>
        <p>{{ dayjs().format('YYYY年MM月DD日 dddd') }}</p>
      </div>
      <div class="dashboard-range">
        <el-segmented
          v-model="range"
          :options="[
            { label: '7天', value: '7' },
            { label: '30天', value: '30' },
            { label: '90天', value: '90' },
            { label: '自定义', value: 'custom' },
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
    <RequestError v-if="loadError" :message="loadError" @retry="load" />
    <div v-if="loading && !data" class="data-panel" aria-busy="true" aria-label="正在加载概览">
      <el-skeleton animated :rows="10" />
    </div>
    <template v-if="data">
      <section class="metric-grid">
        <div v-for="metric in metrics" :key="metric[0]" class="metric-tile">
          <div class="metric-tile__label">{{ metric[0] }}</div>
          <div class="metric-tile__value">{{ metric[1] ?? 0 }}</div>
        </div>
      </section>
      <section class="split-grid">
        <div class="data-panel">
          <h2>业务趋势</h2>
          <div
            v-show="data.inquiryTrend.length || data.vehicleTrend.length"
            ref="chartEl"
            class="chart"
          ></div>
          <el-empty
            v-if="!data.inquiryTrend.length && !data.vehicleTrend.length"
            description="所选时间内暂无趋势数据"
          />
        </div>
        <div class="data-panel">
          <h2>热门车辆</h2>
          <el-table :data="data?.topVehicles || []" size="small" max-height="300">
            <el-table-column prop="stockNo" label="库存号" width="110" />
            <el-table-column prop="nameZh" label="车辆" show-overflow-tooltip />
            <el-table-column label="询盘" width="64" align="right">
              <template #default="scope">
                {{ scope?.row?._count?.inquiries || 0 }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
      <section class="split-grid">
        <div class="data-panel">
          <h2>最近操作</h2>
          <el-table :data="data?.recentAudits || []" size="small" max-height="280">
            <el-table-column prop="actorName" label="管理员" width="120" />
            <el-table-column prop="action" label="操作" width="100" />
            <el-table-column prop="summary" label="内容" show-overflow-tooltip />
            <el-table-column label="时间" width="150">
              <template #default="scope">
                {{ scope?.row ? dayjs(scope.row.createdAt).format('MM-DD HH:mm') : '' }}
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="data-panel">
          <h2>最近登录</h2>
          <el-table :data="data?.recentLogins || []" size="small" max-height="280">
            <el-table-column prop="identifier" label="账号" show-overflow-tooltip />
            <el-table-column prop="ipAddress" label="IP" width="125" />
            <el-table-column label="结果" width="70">
              <template #default="scope">
                <el-tag
                  v-if="scope?.row"
                  size="small"
                  :type="scope.row.success ? 'success' : 'danger'"
                >
                  {{ scope.row.success ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
    </template>
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
