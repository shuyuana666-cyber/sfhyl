<script setup lang="ts">
type Locale = "en" | "ru" | "zh";
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

function update(locale: Locale, value: number | string): void {
  emit("update:modelValue", {
    ...props.modelValue,
    [locale]: String(value)
  });
}
</script>

<template>
  <div class="triple">
    <label>
      <span class="locale-label">{{ placeholders[0] }}</span>
    <el-input
      :model-value="modelValue.zh"
      :placeholder="placeholders[0]"
      :aria-label="placeholders[0]"
      :disabled="disabled"
      :type="inputType"
      :rows="inputType === 'textarea' ? rows : undefined"
      @update:model-value="update('zh', $event)"
    />
    </label>
    <label>
      <span class="locale-label">{{ placeholders[1] }}</span>
    <el-input
      :model-value="modelValue.en"
      :placeholder="placeholders[1]"
      :aria-label="placeholders[1]"
      :disabled="disabled"
      :type="inputType"
      :rows="inputType === 'textarea' ? rows : undefined"
      @update:model-value="update('en', $event)"
    />
    </label>
    <label>
      <span class="locale-label">{{ placeholders[2] }}</span>
    <el-input
      :model-value="modelValue.ru"
      :placeholder="placeholders[2]"
      :aria-label="placeholders[2]"
      :disabled="disabled"
      :type="inputType"
      :rows="inputType === 'textarea' ? rows : undefined"
      @update:model-value="update('ru', $event)"
    />
    </label>
  </div>
</template>

<style scoped>
.triple {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.triple label {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.locale-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--sf-text-secondary);
}

@media (width <= 1024px) {
  .triple {
    grid-template-columns: 1fr;
  }
}
</style>
