<script setup lang="ts">
defineProps<{ message: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <el-alert
    role="alert"
    class="request-error"
    title="数据加载失败"
    type="error"
    show-icon
    :closable="false"
  >
    <template #default>
      <div class="request-error__content">
        <span>{{ message }}</span>
        <el-button link type="danger" @click="$emit('retry')">
          <IconifyIconOnline icon="ri:refresh-line" />重新加载
        </el-button>
      </div>
    </template>
  </el-alert>
</template>

<style scoped>
.request-error {
  margin: 12px 0;
}

.request-error__content {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  overflow-wrap: anywhere;
}
</style>
