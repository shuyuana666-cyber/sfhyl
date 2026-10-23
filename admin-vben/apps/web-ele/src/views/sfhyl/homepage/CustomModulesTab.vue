<script setup lang="ts">
import type { MediaAsset } from "@/types/business";

import type { HomepageCustomModule } from "./useHomepageContentEditor";

import MediaPicker from "@/components/MediaPicker/index.vue";

import ItemActions from "./ItemActions.vue";
import LocalizedInputs from "./LocalizedInputs.vue";

type Direction = -1 | 1;
type PlacementOption = {
  label: string;
  value: HomepageCustomModule["placement"];
};

defineProps<{
  items: HomepageCustomModule[];
  canManage: boolean;
  asset: (id: null | string) => MediaAsset | null;
  rememberAssets: (items: MediaAsset[]) => void;
}>();

const emit = defineEmits<{
  add: [];
  clear: [];
  move: [event: { index: number; direction: Direction }];
  remove: [index: number];
}>();

const allPlacementOptions: PlacementOption[] = [
  { label: "首页优势卡片后", value: "HOME_AFTER_FEATURES" },
  { label: "关于我们简介前", value: "BEFORE_ABOUT" },
  { label: "关于我们简介后", value: "ABOUT_AFTER_INTRO" },
  { label: "视频模块后", value: "AFTER_VIDEOS" }
];

function placementOptions(scope: HomepageCustomModule["displayScope"]): PlacementOption[] {
  if (scope === "HOME") {
    return allPlacementOptions.filter(option => option.value === "HOME_AFTER_FEATURES");
  }
  if (scope === "ABOUT") {
    return allPlacementOptions.filter(option => option.value !== "HOME_AFTER_FEATURES");
  }
  return allPlacementOptions;
}

function updateDisplayScope(
  item: HomepageCustomModule,
  scope: HomepageCustomModule["displayScope"]
) {
  item.displayScope = scope;
  if (!placementOptions(scope).some(option => option.value === item.placement)) {
    item.placement = scope === "HOME"
      ? "HOME_AFTER_FEATURES"
      : scope === "ABOUT"
        ? "ABOUT_AFTER_INTRO"
        : "AFTER_VIDEOS";
  }
}

function processStages(item: HomepageCustomModule) {
  const document = new DOMParser().parseFromString(item.body.zh || "", "text/html");
  const list = document.querySelector("ol");
  return Array.from(list?.children || []).map((element, index) => ({
    index,
    title: element.querySelector("strong")?.textContent?.trim() || `阶段 ${index + 1}`,
    imageMediaId: item.stageImages?.[index]?.imageMediaId || null
  }));
}

function setStageImage(item: HomepageCustomModule, index: number, value: null | string | string[]) {
  if (Array.isArray(value)) return;
  item.stageImages ||= [];
  while (item.stageImages.length <= index) item.stageImages.push({ imageMediaId: null });
  item.stageImages[index] = { imageMediaId: value };
}

</script>

<template>
  <section class="section-heading">
    <div class="module-actions">
      <el-button v-if="canManage" @click="emit('add')">
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
        <el-select
          v-model="item.displayScope"
          :disabled="!canManage"
          @change="updateDisplayScope(item, $event)"
        >
          <el-option label="仅首页" value="HOME" />
          <el-option label="仅关于我们" value="ABOUT" />
          <el-option label="首页和关于我们" value="BOTH" />
        </el-select>
      </label>
      <label>
        展示位置
        <el-select v-model="item.placement" :disabled="!canManage">
          <el-option
            v-for="option in placementOptions(item.displayScope)"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
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

    <h3>{{ item.id === 'home-service-process' ? '通用素材（可选）' : '素材（可选）' }}</h3>
    <el-radio-group v-model="item.mediaType" :disabled="!canManage">
      <el-radio value="NONE">{{ item.id === 'home-service-process' ? '默认配图' : '不展示素材' }}</el-radio>
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

    <section v-if="item.id === 'home-service-process' && item.mediaType !== 'VIDEO'" class="process-stage-images">
      <h3>服务阶段配图</h3>
      <p class="module-hint">每个阶段可使用不同图片；未设置或加载失败时使用通用图片。推荐 1200×675px，主体居中。</p>
      <div v-for="stage in processStages(item)" :key="stage.index" class="process-stage-image">
        <strong>{{ String(stage.index + 1).padStart(2, '0') }} · {{ stage.title }}</strong>
        <MediaPicker :model-value="stage.imageMediaId" :asset="asset(stage.imageMediaId)" :disabled="!canManage" mime-group="image" @update:model-value="setStageImage(item, stage.index, $event)" @select="rememberAssets" />
      </div>
    </section>

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

<style scoped>
.process-stage-images { display: grid; gap: 16px; }
.process-stage-image { min-width: 0; display: grid; gap: 8px; }
.process-stage-image :deep(.selected-media) { grid-template-columns: 128px minmax(0, 1fr); }
.process-stage-image :deep(.selected-media img) { width: 128px; height: 72px; object-fit: cover; }
</style>
