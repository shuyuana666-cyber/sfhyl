<script setup lang="ts">
type Direction = -1 | 1;

const props = withDefaults(
  defineProps<{
    index: number;
    total: number;
    canManage: boolean;
    removeText?: string;
  }>(),
  { removeText: "删除此项" }
);

const emit = defineEmits<{
  move: [direction: Direction];
  remove: [];
}>();
</script>

<template>
  <div class="card-tools">
    <el-button
      v-if="props.canManage"
      text
      :disabled="props.index === 0"
      @click="emit('move', -1)"
    >
      上移
    </el-button>
    <el-button
      v-if="props.canManage"
      text
      :disabled="props.index === props.total - 1"
      @click="emit('move', 1)"
    >
      下移
    </el-button>
    <el-button
      v-if="props.canManage"
      text
      type="danger"
      @click="emit('remove')"
    >
      {{ props.removeText }}
    </el-button>
  </div>
</template>

<style scoped>
.card-tools {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}
</style>
