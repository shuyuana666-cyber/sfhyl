<script setup lang="ts">
import ItemActions from "./ItemActions.vue";
import LocalizedInputs from "./LocalizedInputs.vue";
import MediaPicker from "@/components/MediaPicker/index.vue";
import type { MediaAsset } from "@/types/business";
import type { HomepageHeroItem } from "./useHomepageContentEditor";

type Direction = -1 | 1;

defineProps<{
  enabled: boolean;
  items: HomepageHeroItem[];
  canManage: boolean;
  asset: (id: string | null) => MediaAsset | null;
  rememberAssets: (items: MediaAsset[]) => void;
}>();

const emit = defineEmits<{
  "update:enabled": [value: boolean];
  add: [];
  clear: [];
  move: [event: { index: number; direction: Direction }];
  remove: [index: number];
}>();

function updateEnabled(value: string | number | boolean): void {
  emit("update:enabled", Boolean(value));
}
</script>

<template>
  <div class="module-actions">
    <el-switch
      :model-value="enabled"
      :disabled="!canManage"
      active-text="模块显示"
      inactive-text="模块隐藏"
      @update:model-value="updateEnabled"
    />
    <el-button v-if="canManage" type="primary" @click="emit('add')">
      新增轮播
    </el-button>
    <el-button v-if="canManage" text type="danger" @click="emit('clear')">
      清空并隐藏
    </el-button>
  </div>

  <el-empty
    v-if="!items.length"
    description="暂无轮播，新增后选择图片即可展示。"
  />

  <section v-for="(item, index) in items" :key="index" class="editor-card">
    <ItemActions
      :index="index"
      :total="items.length"
      :can-manage="canManage"
      @move="emit('move', { index, direction: $event })"
      @remove="emit('remove', index)"
    />

    <label>
      桌面图片
      <MediaPicker
        v-model="item.imageMediaId"
        :asset="asset(item.imageMediaId)"
        :disabled="!canManage"
        @select="rememberAssets"
      />
    </label>
    <label>
      移动端图片
      <MediaPicker
        v-model="item.mobileMediaId"
        :asset="asset(item.mobileMediaId)"
        :disabled="!canManage"
        @select="rememberAssets"
      />
    </label>

    <el-switch
      v-model="item.enabled"
      :disabled="!canManage"
      active-text="显示"
      inactive-text="隐藏"
    />
    <LocalizedInputs
      v-model="item.title"
      :placeholders="['中文标题', 'English title', 'Русский заголовок']"
    />
  </section>
</template>
