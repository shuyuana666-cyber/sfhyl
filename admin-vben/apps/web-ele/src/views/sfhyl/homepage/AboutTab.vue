<script setup lang="ts">
import type { MediaAsset } from "@/types/business";

import type { HomepageAboutSection } from "./useHomepageContentEditor";

import MediaPicker from "@/components/MediaPicker/index.vue";

import LocalizedInputs from "./LocalizedInputs.vue";

defineProps<{
  canManage: boolean;
  asset: (id: null | string) => MediaAsset | null;
  rememberAssets: (items: MediaAsset[]) => void;
}>();

const emit = defineEmits<{ clear: [] }>();

const section = defineModel<HomepageAboutSection>("section", {
  required: true
});

</script>

<template>
  <section class="editor-card">
    <div class="module-actions">
      <el-switch
        v-model="section.enabled"
        :disabled="!canManage"
        active-text="模块显示"
        inactive-text="模块隐藏"
      />
      <el-button v-if="canManage" text type="danger" @click="emit('clear')">
        清空并隐藏
      </el-button>
    </div>

    <h3>标题</h3>
    <LocalizedInputs
      :disabled="!canManage"
v-model="section.title"
      :placeholders="['中文标题', 'English title', 'Русский заголовок']"
    />

    <h3>正文（支持富文本 HTML）</h3>
    <LocalizedInputs
      :disabled="!canManage"
v-model="section.body"
      :placeholders="['中文正文', 'English body', 'Русский текст']"
      input-type="textarea"
      :rows="6"
    />

    <h3>按钮</h3>
    <el-input
      v-model="section.button.href"
      placeholder="按钮链接，例如 /contact 或 #footer"
    />
    <LocalizedInputs
      :disabled="!canManage"
v-model="section.button.label"
      :placeholders="[
        '中文按钮文字',
        'English button text',
        'Русский текст кнопки'
      ]"
    />

    <label>
      介绍视频
      <MediaPicker
        v-model="section.videoMediaId"
        mime-group="video"
        :asset="asset(section.videoMediaId)"
        :disabled="!canManage"
        @select="rememberAssets"
      />
    </label>
    <label>
      视频封面
      <MediaPicker
        v-model="section.posterMediaId"
        :asset="asset(section.posterMediaId)"
        :disabled="!canManage"
        @select="rememberAssets"
      />
    </label>
  </section>
</template>
