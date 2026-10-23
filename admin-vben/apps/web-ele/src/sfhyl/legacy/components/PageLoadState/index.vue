<script setup lang="ts">
import RequestError from '@/components/RequestError/index.vue';

withDefaults(defineProps<{ loading: boolean; error: string; ready?: boolean }>(), { ready: false });
defineEmits<{ retry: [] }>();
</script>

<template>
  <RequestError v-if="error" :message="error" @retry="$emit('retry')" />
  <section v-else-if="loading && !ready" class="page-loading" aria-label="正在加载页面" aria-busy="true">
    <el-skeleton animated :rows="6" />
  </section>
</template>

<style scoped>
.page-loading {
  min-height: 240px;
  padding: 24px;
  background: var(--sf-surface);
  border: 1px solid var(--sf-divider);
  border-radius: var(--sf-radius-lg);
}
</style>
