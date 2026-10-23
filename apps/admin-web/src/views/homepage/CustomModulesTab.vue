<script setup lang="ts">
import ItemActions from "./ItemActions.vue";
import LocalizedInputs from "./LocalizedInputs.vue";
import MediaPicker from "@/components/MediaPicker/index.vue";
import type { MediaAsset } from "@/types/business";
import type { HomepageCustomModule } from "./useHomepageContentEditor";

type Direction = -1 | 1;

defineProps<{
  items: HomepageCustomModule[];
  canManage: boolean;
  asset: (id: string | null) => MediaAsset | null;
  rememberAssets: (items: MediaAsset[]) => void;
}>();

const emit = defineEmits<{
  add: [];
  clear: [];
  move: [event: { index: number; direction: Direction }];
  remove: [index: number];
}>();
</script>

<template>
  <section class="section-heading">
    <div class="module-actions">
      <el-button v-if="canManage" type="primary" @click="emit('add')">
        新增自定义模块
      </el-button>
      <el-button
        v-if="canManage"
        text
        type="danger"
        :disabled="!items.length"
        @click="emit('clear')"
      >
        清空全部
      </el-button>
    </div>
    <p class="module-hint">
      每个模块可独立排序、显示或隐藏，并可设置展示页面和展示位置。
    </p>
  </section>

  <el-empty v-if="!items.length" description="暂无自定义模块。" />
  <section v-for="(item, index) in items" :key="item.id" class="editor-card">
    <ItemActions
      :index="index"
      :total="items.length"
      :can-manage="canManage"
      remove-text="删除此模块"
      @move="emit('move', { index, direction: $event })"
      @remove="emit('remove', index)"
    />

    <el-switch
      v-model="item.enabled"
      :disabled="!canManage"
      active-text="显示"
      inactive-text="隐藏"
    />

    <div class="triple module-display-controls">
      <label>
        展示页面
        <el-select v-model="item.displayScope" :disabled="!canManage">
          <el-option label="仅首页" value="HOME" />
          <el-option label="仅关于我们" value="ABOUT" />
          <el-option label="首页和关于我们" value="BOTH" />
        </el-select>
      </label>
      <label>
        展示位置
        <el-select v-model="item.placement" :disabled="!canManage">
          <el-option label="关于我们标题上方" value="BEFORE_ABOUT" />
          <el-option label="视频模块后" value="AFTER_VIDEOS" />
        </el-select>
      </label>
    </div>

    <h3>标题</h3>
    <LocalizedInputs
      v-model="item.title"
      :placeholders="['中文标题', 'English title', 'Русский заголовок']"
      :disabled="!canManage"
    />

    <h3>正文（支持富文本 HTML）</h3>
    <LocalizedInputs
      v-model="item.body"
      :placeholders="['中文正文', 'English body', 'Русский текст']"
      :disabled="!canManage"
      input-type="textarea"
      :rows="6"
    />

    <h3>素材（可选）</h3>
    <el-radio-group v-model="item.mediaType" :disabled="!canManage">
      <el-radio value="NONE">不展示素材</el-radio>
      <el-radio value="IMAGE">图片</el-radio>
      <el-radio value="VIDEO">视频</el-radio>
    </el-radio-group>

    <label v-if="item.mediaType === 'IMAGE'">
      图片
      <MediaPicker
        v-model="item.imageMediaId"
        mime-group="image"
        :asset="asset(item.imageMediaId)"
        :disabled="!canManage"
        @select="rememberAssets"
      />
    </label>
    <template v-else-if="item.mediaType === 'VIDEO'">
      <label>
        视频
        <MediaPicker
          v-model="item.videoMediaId"
          mime-group="video"
          :asset="asset(item.videoMediaId)"
          :disabled="!canManage"
          @select="rememberAssets"
        />
      </label>
      <label>
        视频封面（可选）
        <MediaPicker
          v-model="item.posterMediaId"
          mime-group="image"
          :asset="asset(item.posterMediaId)"
          :disabled="!canManage"
          @select="rememberAssets"
        />
      </label>
    </template>

    <h3>按钮（可选）</h3>
    <el-input
      v-model="item.button.href"
      :disabled="!canManage"
      placeholder="按钮链接，例如 /contact、#about 或 https://example.com"
    />
    <LocalizedInputs
      v-model="item.button.label"
      :placeholders="[
        '中文按钮文字',
        'English button text',
        'Русский текст кнопки'
      ]"
      :disabled="!canManage"
    />
  </section>
</template>
