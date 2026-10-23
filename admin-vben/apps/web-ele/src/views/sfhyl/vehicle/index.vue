<script setup lang="ts">
import type { Vehicle } from '@/types/business';

import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  batchVehicles,
  deleteVehicle,
  duplicateVehicle,
  exportVehicles,
  offlineVehicle,
  publishVehicle,
  restoreVehicle,
  setVehicleFeatured,
  setVehicleSaleStatus,
} from '@/api/vehicles';
import RequestError from '@/components/RequestError/index.vue';
import { hasPerms } from '@/utils/auth';
import { resolveMediaUrl } from '@/utils/media';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';

import { useVehicleListQuery } from './useVehicleListQuery';

defineOptions({ name: 'VehicleList' });
const route = useRoute();
const router = useRouter();
const {
  advancedOpen,
  brands,
  categories,
  initializing,
  load,
  loadError,
  loadModelOptions,
  loadSeriesOptions,
  loading,
  models,
  pageTitle,
  query,
  reset,
  rows,
  series,
  total,
} = useVehicleListQuery(route);
const selected = ref<Vehicle[]>([]);

const statusMap: Record<string, [string, 'danger' | 'info' | 'success' | 'warning']> = {
  DRAFT: ['草稿', 'info'],
  PUBLISHED: ['已发布', 'success'],
  OFFLINE: ['已下架', 'warning'],
  ARCHIVED: ['已归档', 'danger'],
};
const saleMap: Record<string, [string, 'info' | 'success' | 'warning']> = {
  AVAILABLE: ['在售', 'success'],
  RESERVED: ['已预订', 'warning'],
  SOLD: ['已售', 'info'],
};

async function run(id: string, action: string): Promise<void> {
  if (action === 'publish') await publishVehicle(id);
  if (action === 'offline') await offlineVehicle(id);
  if (action === 'restore') await restoreVehicle(id);
  if (action === 'duplicate') await duplicateVehicle(id);
  ElMessage.success('操作完成');
  await load();
}
async function confirmDeletion(message: string, title: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      type: 'warning',
      confirmButtonText: title,
      cancelButtonText: '取消',
    });
    return true;
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return false;
    throw reason;
  }
}
async function remove(row: Vehicle): Promise<void> {
  if (!(await confirmDeletion(`确认删除车辆“${row.nameZh}”？车辆将进入回收状态。`, '删除车辆'))) return;
  await deleteVehicle(row.id);
  ElMessage.success('已删除');
  await load();
}
async function rowCommand(row: Vehicle, command: string): Promise<void> {
  if (command === 'preview') preview(row);
  if (command === 'publish' || command === 'offline') await run(row.id, command);
  if (command === 'duplicate') await run(row.id, 'duplicate');
  if (command === 'restore') await run(row.id, 'restore');
  if (command === 'delete') await remove(row);
  if (command === 'feature') {
    await setVehicleFeatured(row.id, !row.isFeatured);
    await load();
  }
}
async function batch(action: string): Promise<void> {
  if (!selected.value.length) {
    ElMessage.warning('请先选择车辆');
    return;
  }
  if (action === 'DELETE') {
    if (!(await confirmDeletion(`确认批量删除已选择的 ${selected.value.length} 辆车？`, '批量删除'))) return;
  }
  await batchVehicles(
    selected.value.map((item) => item.id),
    action,
  );
  ElMessage.success('批量操作完成');
  await load();
}
function preview(row: Vehicle): void {
  const siteUrl = String(import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
  window.open(
    `${siteUrl}/vehicle/${encodeURIComponent(row.slug)}`,
    '_blank',
    'noopener,noreferrer',
  );
}
</script>

<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>{{ pageTitle }}</h1>
        <p>车辆资料、发布状态和销售状态</p>
      </div>
      <el-button
        v-if="hasPerms('vehicle:create')"
        type="primary"
        @click="router.push('/vehicles/create')"
      >
        <IconifyIconOnline icon="ri:add-line" />新增车辆
      </el-button>
    </div>
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        clearable
        aria-label="搜索车辆名称、库存号或 VIN"
        placeholder="名称 / 库存号 / VIN"
        style="width: 220px"
        @keyup.enter="
          query.page = 1;
          load();
        "
      />
      <el-button
        :class="{ 'filter-toggle-active': advancedOpen }"
        :aria-expanded="advancedOpen"
        @click="advancedOpen = !advancedOpen"
      >
        <IconifyIconOnline icon="ri:equalizer-2-line" />高级筛选
      </el-button>
      <el-select
        v-show="advancedOpen"
        v-model="query.brandId"
        clearable
        aria-label="品牌"
        placeholder="品牌"
        style="width: 150px"
        @change="loadSeriesOptions"
      >
        <el-option
          v-for="brand in brands"
          :key="brand.id"
          :label="brand.nameZh"
          :value="brand.id"
        />
      </el-select>
      <el-select
        v-show="advancedOpen"
        v-model="query.seriesId"
        clearable
        filterable
        :disabled="!query.brandId"
        aria-label="车系"
        placeholder="车系"
        style="width: 150px"
        @change="loadModelOptions"
      >
        <el-option v-for="item in series" :key="item.id" :label="item.nameZh" :value="item.id" />
      </el-select>
      <el-select
        v-show="advancedOpen"
        v-model="query.modelId"
        clearable
        filterable
        :disabled="!query.seriesId"
        aria-label="车型"
        placeholder="车型"
        style="width: 150px"
      >
        <el-option v-for="item in models" :key="item.id" :label="item.nameZh" :value="item.id" />
      </el-select>
      <el-select
        v-show="advancedOpen"
        v-model="query.categoryId"
        clearable
        filterable
        aria-label="车辆分类"
        placeholder="车辆分类"
        style="width: 150px"
      >
        <el-option
          v-for="item in categories"
          :key="item.id"
          :label="item.nameZh"
          :value="item.id"
        />
      </el-select>
      <el-select
        v-model="query.type"
        clearable
        aria-label="车辆类型"
        placeholder="车辆类型"
        style="width: 120px"
      >
        <el-option label="新车" value="NEW" /><el-option label="二手车" value="USED" />
      </el-select>
      <el-select
        v-show="advancedOpen"
        v-model="query.isFeatured"
        clearable
        aria-label="推荐状态"
        placeholder="推荐状态"
        style="width: 120px"
      >
        <el-option label="已推荐" value="true" /><el-option label="未推荐" value="false" />
      </el-select>
      <el-select
        v-model="query.status"
        clearable
        aria-label="发布状态"
        placeholder="发布状态"
        style="width: 130px"
      >
        <el-option v-for="(item, key) in statusMap" :key="key" :label="item[0]" :value="key" />
      </el-select>
      <el-select
        v-model="query.saleStatus"
        clearable
        aria-label="销售状态"
        placeholder="销售状态"
        style="width: 130px"
      >
        <el-option v-for="(item, key) in saleMap" :key="key" :label="item[0]" :value="key" />
      </el-select>
      <el-select
        v-show="advancedOpen"
        aria-label="车辆回收状态"
        v-model="query.deleted"
        style="width: 120px"
      >
        <el-option label="正常车辆" value="false" /><el-option label="回收站" value="true" />
      </el-select>
      <el-input-number
        v-show="advancedOpen"
        v-model="query.yearMin"
        :min="1900"
        :max="2200"
        controls-position="right"
        aria-label="起始年份"
        placeholder="起始年份"
        style="width: 130px"
      />
      <el-input-number
        v-show="advancedOpen"
        v-model="query.yearMax"
        :min="1900"
        :max="2200"
        controls-position="right"
        aria-label="结束年份"
        placeholder="结束年份"
        style="width: 130px"
      />
      <el-input
        v-show="advancedOpen"
        v-model="query.priceMin"
        aria-label="最低价格"
        placeholder="最低价格"
        style="width: 120px"
      />
      <el-input
        v-show="advancedOpen"
        v-model="query.priceMax"
        aria-label="最高价格"
        placeholder="最高价格"
        style="width: 120px"
      />
      <el-date-picker
        v-if="advancedOpen"
        v-model="query.createdFrom"
        type="date"
        value-format="YYYY-MM-DD"
        aria-label="创建开始"
        placeholder="创建开始"
      />
      <el-date-picker
        v-if="advancedOpen"
        v-model="query.createdTo"
        type="date"
        value-format="YYYY-MM-DD"
        aria-label="创建结束"
        placeholder="创建结束"
      />
      <el-date-picker
        v-if="advancedOpen"
        v-model="query.publishedFrom"
        type="date"
        value-format="YYYY-MM-DD"
        aria-label="发布开始"
        placeholder="发布开始"
      />
      <el-date-picker
        v-if="advancedOpen"
        v-model="query.publishedTo"
        type="date"
        value-format="YYYY-MM-DD"
        aria-label="发布结束"
        placeholder="发布结束"
      />
      <el-select aria-label="排序字段" v-model="query.sortBy" style="width: 135px">
        <el-option label="创建时间" value="createdAt" />
        <el-option label="更新时间" value="updatedAt" />
        <el-option label="发布时间" value="publishedAt" />
        <el-option label="价格" value="price" />
        <el-option label="年份" value="year" />
      </el-select>
      <el-segmented
        v-model="query.sortOrder"
        :options="[
          { label: '降序', value: 'desc' },
          { label: '升序', value: 'asc' },
        ]"
      />
      <el-button
        type="primary"
        @click="
          query.page = 1;
          load();
        "
      >
        查询
</el-button><el-button @click="reset">重置</el-button>
    </div>
    <RequestError v-if="!initializing && loadError" :message="loadError" @retry="load" />
    <div class="action-bar">
      <div>
        <el-dropdown v-if="hasPerms('vehicle:batch')" @command="batch">
          <el-button :disabled="!selected.length">
            批量操作<IconifyIconOnline icon="ri:arrow-down-s-line" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="PUBLISH">批量发布</el-dropdown-item>
              <el-dropdown-item command="OFFLINE">批量下架</el-dropdown-item>
              <el-dropdown-item command="FEATURE">批量推荐</el-dropdown-item>
              <el-dropdown-item command="UNFEATURE">取消推荐</el-dropdown-item>
              <el-dropdown-item command="SOLD">标记已售</el-dropdown-item>
              <el-dropdown-item command="AVAILABLE">恢复在售</el-dropdown-item>
              <el-dropdown-item command="RESTORE">批量恢复</el-dropdown-item>
              <el-dropdown-item command="DELETE" divided> 批量删除 </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <span class="selection-summary" role="status">{{
          selected.length ? `已选择 ${selected.length} 辆` : `共 ${total} 辆车辆`
        }}</span>
      </div>
      <el-button v-if="hasPerms('vehicle:export')" @click="exportVehicles(query)">
        <IconifyIconOnline icon="ri:download-2-line" />导出 CSV
      </el-button>
    </div>
    <div v-if="initializing" class="table-wrap vehicle-list-loading" aria-busy="true">
      <el-skeleton animated :rows="9" />
      <p>正在加载车辆...</p>
    </div>
    <div v-else-if="!loadError" class="table-wrap">
      <el-table v-loading="loading" :data="rows" row-key="id" @selection-change="selected = $event">
        <el-table-column type="selection" width="46" />
        <el-table-column label="车辆" min-width="250">
          <template #default="{ row = {} } = {}">
            <div style="display: flex; gap: 10px; align-items: center">
              <div v-if="!row.coverMedia?.url" class="vehicle-cover-placeholder">暂无图片</div>
              <el-image
                v-else
                :src="resolveMediaUrl(row.coverMedia?.url)"
                fit="cover"
                style="width: 72px; height: 48px; background: #eef0f2; border-radius: 4px"
              />
              <div class="vehicle-cell-copy">
                <strong :title="row.nameZh">{{ row.nameZh }}</strong>
                <div style="font-size: 12px; color: #7a838d">
                  {{ row.stockNo }} · {{ row.nameEn }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="brand.nameZh"
          label="品牌"
          show-overflow-tooltip
          width="110"
        /><el-table-column prop="year" label="年份" width="76" />
        <el-table-column label="价格" width="130" align="right">
          <template #default="{ row = {} } = {}">
            {{ row.currency }}
            {{ Number(row.price).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="发布" width="90">
          <template #default="{ row = {} } = {}">
            <el-tag size="small" :type="statusMap[row.status]?.[1]">
              {{ statusMap[row.status]?.[0] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="销售" width="90">
          <template #default="{ row = {} } = {}">
            <el-dropdown
              v-if="hasPerms('vehicle:update')"
              @command="(value) => setVehicleSaleStatus(row.id, value).then(load)"
            >
              <el-tag size="small" :type="saleMap[row.saleStatus]?.[1]" style="cursor: pointer">
                {{ saleMap[row.saleStatus]?.[0] }}
</el-tag><template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="(item, key) in saleMap" :key="key" :command="key">
                    {{ item[0] }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
</el-dropdown><el-tag v-else size="small">
              {{ saleMap[row.saleStatus]?.[0] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="140">
          <template #default="{ row = {} } = {}">
            {{ dayjs(row.updatedAt).format('MM-DD HH:mm') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row = {} } = {}">
            <el-button
              v-if="hasPerms('vehicle:update') && !row.deletedAt"
              link
              type="primary"
              @click="router.push(`/vehicles/edit/${row.id}`)"
            >
              编辑
</el-button><el-dropdown
              v-if="
                !row.deletedAt ||
                (hasPerms('vehicle:offline') && row.status === 'PUBLISHED') ||
                (row.deletedAt && hasPerms('vehicle:restore'))
              "
              trigger="click"
              @command="(command) => rowCommand(row as Vehicle, command)"
            >
              <el-button link> 更多<IconifyIconOnline icon="ri:more-2-fill" /> </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="!row.deletedAt" command="preview">
预览官网
</el-dropdown-item>
                  <el-dropdown-item
                    v-if="
                      hasPerms('vehicle:publish') && row.status !== 'PUBLISHED' && !row.deletedAt
                    "
                    command="publish"
                    >
发布车辆
</el-dropdown-item>
                  <el-dropdown-item
                    v-if="hasPerms('vehicle:offline') && row.status === 'PUBLISHED'"
                    command="offline"
                    >
下架车辆
</el-dropdown-item>
                  <el-dropdown-item
                    v-if="hasPerms('vehicle:create') && !row.deletedAt"
                    command="duplicate"
                  >
                    复制车辆
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="hasPerms('vehicle:update') && !row.deletedAt"
                    command="feature"
                  >
                    {{ row.isFeatured ? '取消推荐' : '设为推荐' }}
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="row.deletedAt && hasPerms('vehicle:restore')"
                    command="restore"
                  >
                    恢复车辆
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="!row.deletedAt && hasPerms('vehicle:delete')"
                    command="delete"
                    divided
                  >
                    删除车辆
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty v-if="!loading" description="暂无车辆" />
        </template>
      </el-table>
    </div>
    <div v-if="!initializing && !loadError && total > 0" class="pagination-row">
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
.vehicle-list-loading {
  min-height: 360px;
  padding: 24px;
}

.vehicle-list-loading p {
  margin: 20px 0 0;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.vehicle-cover-placeholder {
  display: grid;
  flex: 0 0 72px;
  place-items: center;
  width: 72px;
  height: 48px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>
