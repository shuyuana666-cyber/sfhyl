<script setup lang="ts">
import type { VehicleFormModel } from "./vehicle-form.model";

const form = defineModel<VehicleFormModel>("form", { required: true });
const highlightsText = defineModel<string>("highlightsText", {
  required: true
});
const specificationsText = defineModel<string>("specificationsText", {
  required: true
});
</script>

<template>
  <section class="form-section">
    <h2>车辆描述</h2>
    <div class="form-grid one-column">
      <el-form-item label="中文摘要">
        <el-input
          v-model="form.shortDescriptionZh"
          type="textarea"
          :rows="3"
          maxlength="5000"
          show-word-limit
        />
      </el-form-item>
      <el-form-item label="中文正文（按 Enter 换行，支持安全 HTML）">
        <el-input v-model="form.descriptionZh" type="textarea" :rows="10" />
      </el-form-item>
      <el-form-item label="核心亮点（每行一项）">
        <el-input v-model="highlightsText" type="textarea" :rows="6" />
      </el-form-item>
      <el-form-item label="车辆配置（JSON）">
        <el-input
          v-model="specificationsText"
          type="textarea"
          :rows="8"
          class="code-input"
        />
      </el-form-item>
    </div>
  </section>
</template>
