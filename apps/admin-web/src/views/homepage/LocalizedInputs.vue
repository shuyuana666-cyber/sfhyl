<script setup lang="ts">
type Locale = "zh" | "en" | "ru";
type LocalizedText = Record<Locale, string>;

const props = withDefaults(
  defineProps<{
    modelValue: LocalizedText;
    placeholders: [string, string, string];
    disabled?: boolean;
    inputType?: "text" | "textarea";
    rows?: number;
  }>(),
  {
    disabled: false,
    inputType: "text",
    rows: 2
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: LocalizedText];
}>();

function update(locale: Locale, value: string | number): void {
  emit("update:modelValue", {
    ...props.modelValue,
    [locale]: String(value)
  });
}
</script>

<template>
  <div class="triple">
    <el-input
      :model-value="modelValue.zh"
      :placeholder="placeholders[0]"
      :disabled="disabled"
      :type="inputType"
      :rows="inputType === 'textarea' ? rows : undefined"
      @update:model-value="update('zh', $event)"
    />
    <el-input
      :model-value="modelValue.en"
      :placeholder="placeholders[1]"
      :disabled="disabled"
      :type="inputType"
      :rows="inputType === 'textarea' ? rows : undefined"
      @update:model-value="update('en', $event)"
    />
    <el-input
      :model-value="modelValue.ru"
      :placeholder="placeholders[2]"
      :disabled="disabled"
      :type="inputType"
      :rows="inputType === 'textarea' ? rows : undefined"
      @update:model-value="update('ru', $event)"
    />
  </div>
</template>

<style scoped>
.triple {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (width <= 760px) {
  .triple {
    grid-template-columns: 1fr;
  }
}
</style>
