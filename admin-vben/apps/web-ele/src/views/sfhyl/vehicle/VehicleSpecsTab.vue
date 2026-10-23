<script setup lang="ts">
import type { VehicleFormModel } from "./vehicle-form.model";

const form = defineModel<VehicleFormModel>("form", { required: true });
</script>

<template>
  <section class="form-section">
    <h2>价格信息</h2>
    <div class="form-grid">
      <el-form-item label="销售价格" prop="price">
        <el-input v-model="form.price" placeholder="留空显示询价">
          <template #prepend>{{ form.currency }}</template>
        </el-input>
      </el-form-item>
      <el-form-item label="原价">
        <el-input v-model="form.originalPrice" />
      </el-form-item>
      <el-form-item label="货币">
        <el-select v-model="form.currency">
          <el-option
            v-for="item in ['CNY', 'USD', 'RUB', 'EUR']"
            :key="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="销售状态">
        <el-select v-model="form.saleStatus">
          <el-option label="在售" value="AVAILABLE" />
          <el-option label="已预订" value="RESERVED" />
          <el-option label="已售" value="SOLD" />
        </el-select>
      </el-form-item>
      <el-form-item label="价格说明">
        <el-input v-model="form.priceNote" />
      </el-form-item>
    </div>
  </section>

  <section class="form-section">
    <h2>车辆参数</h2>
    <div class="form-grid">
      <el-form-item label="里程">
        <el-input-number v-model="form.mileage" :min="0" />
        <el-select v-model="form.mileageUnit" class="unit-select">
          <el-option label="公里" value="KM" />
          <el-option label="英里" value="MI" />
        </el-select>
      </el-form-item>
      <el-form-item label="排量 (L)">
        <el-input v-model="form.displacement" />
      </el-form-item>
      <el-form-item label="燃料类型">
        <el-input v-model="form.fuelType" />
      </el-form-item>
      <el-form-item label="变速箱">
        <el-input v-model="form.transmission" />
      </el-form-item>
      <el-form-item label="驱动方式">
        <el-input v-model="form.driveType" />
      </el-form-item>
      <el-form-item label="车身类型">
        <el-input v-model="form.bodyType" />
      </el-form-item>
      <el-form-item label="车门数">
        <el-input-number v-model="form.doors" :min="1" :max="20" />
      </el-form-item>
      <el-form-item label="座位数">
        <el-input-number v-model="form.seats" :min="1" :max="100" />
      </el-form-item>
      <el-form-item label="车身颜色">
        <el-input v-model="form.exteriorColor" />
      </el-form-item>
      <el-form-item label="内饰颜色">
        <el-input v-model="form.interiorColor" />
      </el-form-item>
      <el-form-item label="发动机型号">
        <el-input v-model="form.engineModel" />
      </el-form-item>
      <el-form-item label="发动机功率">
        <el-input v-model="form.enginePower" />
      </el-form-item>
      <el-form-item label="电池容量 (kWh)">
        <el-input v-model="form.batteryCapacity" />
      </el-form-item>
      <el-form-item label="续航里程 (km)">
        <el-input-number v-model="form.rangeKm" :min="0" />
      </el-form-item>
      <el-form-item label="排放标准">
        <el-input v-model="form.emissionStandard" />
      </el-form-item>
      <el-form-item label="车辆尺寸">
        <el-input v-model="form.dimensions" placeholder="长 x 宽 x 高" />
      </el-form-item>
      <el-form-item label="整备质量 (kg)">
        <el-input-number v-model="form.curbWeightKg" :min="0" />
      </el-form-item>
    </div>
  </section>
</template>
