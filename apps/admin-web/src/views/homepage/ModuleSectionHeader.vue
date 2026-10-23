<script setup lang="ts">
import LocalizedInputs from "./LocalizedInputs.vue";

type LocalizedText = { zh: string; en: string; ru: string };

const props = defineProps<{
  enabled: boolean;
  title: LocalizedText;
  titlePlaceholders: [string, string, string];
  canManage: boolean;
  addText: string;
}>();

const emit = defineEmits<{
  "update:enabled": [value: boolean];
  "update:title": [value: LocalizedText];
  add: [];
  clear: [];
}>();

function updateEnabled(value: string | number | boolean): void {
  emit("update:enabled", Boolean(value));
}
</script>

<template>
  <section class="section-heading">
    <div class="module-actions">
      <el-switch
        :model-value="props.enabled"
        :disabled="!props.canManage"
        active-text="模块显示"
        inactive-text="模块隐藏"
        @update:model-value="updateEnabled"
      />
      <el-button
        v-if="props.canManage"
        text
        type="danger"
        @click="emit('clear')"
      >
        清空并隐藏
      </el-button>
    </div>

    <LocalizedInputs
      :model-value="props.title"
      :placeholders="props.titlePlaceholders"
      @update:model-value="emit('update:title', $event)"
    />

    <el-button v-if="props.canManage" type="primary" @click="emit('add')">
      {{ props.addText }}
    </el-button>
  </section>
</template>
