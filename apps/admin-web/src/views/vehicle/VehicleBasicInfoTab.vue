<script setup lang="ts">
import type {
  Brand,
  VehicleCategory,
  VehicleModel,
  VehicleSeries,
  VehicleTag
} from "@/types/business";
import type { VehicleFormModel } from "./vehicle-form.model";

const form = defineModel<VehicleFormModel>("form", { required: true });

defineProps<{
  filteredBrands: Brand[];
  series: VehicleSeries[];
  models: VehicleModel[];
  categories: VehicleCategory[];
  tags: VehicleTag[];
  creatingBrand: boolean;
  brandNameToCreate: string;
  createBrandOptionValue: string;
}>();

const emit = defineEmits<{
  "filter-brands": [query: string];
  "brand-dropdown-visible-change": [visible: boolean];
  "brand-change": [value: string | undefined];
  "series-change": [];
}>();

function filterBrands(query: string): void {
  emit("filter-brands", query);
}

function handleBrandChange(value: string | undefined): void {
  emit("brand-change", value);
}
</script>

<template>
  <section class="form-section">
    <h2>车辆标识</h2>
    <div class="form-grid">
      <el-form-item label="中文车辆名称" prop="nameZh">
        <el-input v-model="form.nameZh" maxlength="255" />
      </el-form-item>
      <el-form-item label="库存编号">
        <el-input
          v-model="form.stockNo"
          maxlength="100"
          placeholder="留空后自动按日期生成"
        />
      </el-form-item>
      <el-form-item label="VIN">
        <el-input v-model="form.vin" maxlength="64" />
      </el-form-item>
    </div>
  </section>

  <section class="form-section">
    <h2>归类信息</h2>
    <div class="form-grid">
      <el-form-item label="车辆类型">
        <el-segmented
          v-model="form.type"
          :options="[
            { label: '新车', value: 'NEW' },
            { label: '二手车', value: 'USED' }
          ]"
        />
      </el-form-item>
      <el-form-item label="品牌" prop="brandId">
        <el-select
          v-model="form.brandId"
          clearable
          filterable
          :filter-method="filterBrands"
          :loading="creatingBrand"
          :disabled="creatingBrand"
          @visible-change="emit('brand-dropdown-visible-change', $event)"
          @change="handleBrandChange"
        >
          <el-option
            v-for="item in filteredBrands"
            :key="item.id"
            :label="item.nameZh"
            :value="item.id"
          />
          <el-option
            v-if="createBrandOptionValue"
            :label="`创建品牌：${brandNameToCreate}`"
            :value="createBrandOptionValue"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="车系">
        <el-select
          v-model="form.seriesId"
          clearable
          filterable
          :disabled="!form.brandId"
          @change="emit('series-change')"
        >
          <el-option
            v-for="item in series"
            :key="item.id"
            :label="item.nameZh"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="车型">
        <el-select
          v-model="form.modelId"
          clearable
          filterable
          :disabled="!form.seriesId"
        >
          <el-option
            v-for="item in models"
            :key="item.id"
            :label="item.nameZh"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="车辆分类">
        <el-select v-model="form.categoryId" clearable filterable>
          <el-option
            v-for="item in categories"
            :key="item.id"
            :label="item.nameZh"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="车辆标签">
        <el-select v-model="form.tagIds" multiple filterable>
          <el-option
            v-for="item in tags"
            :key="item.id"
            :label="item.nameZh"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="年份" prop="year">
        <el-input-number
          v-model="form.year"
          :min="1900"
          :max="2200"
          controls-position="right"
        />
      </el-form-item>
      <el-form-item label="生产日期">
        <el-date-picker
          v-model="form.manufactureDate"
          type="date"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>
      <el-form-item label="首次登记日期">
        <el-date-picker
          v-model="form.registrationDate"
          type="date"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>
      <el-form-item label="车辆所在地">
        <el-input v-model="form.location" />
      </el-form-item>
    </div>
  </section>
</template>
