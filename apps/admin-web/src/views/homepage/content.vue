<script setup lang="ts">
import { useHomepageContentEditor } from "./useHomepageContentEditor";
import LocalizedInputs from "./LocalizedInputs.vue";
import ItemActions from "./ItemActions.vue";
import CustomModulesTab from "./CustomModulesTab.vue";
import AboutTab from "./AboutTab.vue";
import HeroTab from "./HeroTab.vue";
import ModuleSectionHeader from "./ModuleSectionHeader.vue";
import MediaPicker from "@/components/MediaPicker/index.vue";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";

defineOptions({ name: "HomepageContent" });

const {
  active,
  add,
  asset,
  canManage,
  clearModule,
  content,
  dirty,
  load,
  loadError,
  loading,
  move,
  rememberAssets,
  remove,
  save,
  saving
} = useHomepageContentEditor();

useUnsavedChanges(dirty);
</script>

<template>
  <div
    v-loading="loading"
    class="admin-page homepage-content"
    :class="{ 'is-readonly': !canManage }"
  >
    <div class="page-heading">
      <div>
        <h1>首页展示内容</h1>
        <p>首页和“关于我们”页面共用此配置；图片和视频从素材库选择。</p>
      </div>
      <div>
        <el-button
          v-if="canManage"
          :loading="saving"
          :disabled="loading || Boolean(loadError)"
          @click="save(false)"
          >保存草稿</el-button
        ><el-button
          v-if="canManage"
          type="primary"
          :loading="saving"
          :disabled="loading || Boolean(loadError)"
          @click="save(true)"
          >保存并发布</el-button
        >
      </div>
    </div>
    <div v-if="loadError" class="load-error" role="alert">
      <el-alert
        title="首页内容加载失败"
        :description="loadError"
        type="error"
        :closable="false"
        show-icon
      />
      <el-button type="primary" :loading="loading" @click="load">
        重新加载
      </el-button>
    </div>
    <el-tabs v-else v-model="active">
      <el-tab-pane label="顶部轮播" name="hero">
        <HeroTab
          v-model:enabled="content.heroEnabled"
          :items="content.hero"
          :can-manage="canManage"
          :asset="asset"
          :remember-assets="rememberAssets"
          @add="add('hero')"
          @clear="clearModule('hero')"
          @move="move(content.hero, $event.index, $event.direction)"
          @remove="remove(content.hero, $event, '轮播')"
        />
      </el-tab-pane>
      <el-tab-pane label="关于我们" name="about">
        <AboutTab
          v-model:section="content.about"
          :can-manage="canManage"
          :asset="asset"
          :remember-assets="rememberAssets"
          @clear="clearModule('about')"
        />
      </el-tab-pane>
      <el-tab-pane label="运输与交付" name="transport"
        ><ModuleSectionHeader
          v-model:enabled="content.transport.enabled"
          v-model:title="content.transport.title"
          :title-placeholders="[
            '中文模块标题',
            'English section title',
            'Русский заголовок раздела'
          ]"
          :can-manage="canManage"
          add-text="新增图片"
          @add="add('transport')"
          @clear="clearModule('transport')" />
        <el-empty
          v-if="!content.transport.items.length"
          description="暂无运输图片。" />
        <section
          v-for="(item, index) in content.transport.items"
          :key="index"
          class="editor-card"
        >
          <ItemActions
            :index="index"
            :total="content.transport.items.length"
            :can-manage="canManage"
            @move="move(content.transport.items, index, $event)"
            @remove="remove(content.transport.items, index, '运输图片')"
          />
          <MediaPicker
            v-model="item.imageMediaId"
            :asset="asset(item.imageMediaId)"
            :disabled="!canManage"
            @select="rememberAssets"
          />
          <LocalizedInputs
            v-model="item.title"
            :placeholders="['中文标题', 'English title', 'Русский заголовок']"
          />
          <LocalizedInputs
            v-model="item.description"
            :placeholders="[
              '中文说明',
              'English description',
              'Русское описание'
            ]"
            input-type="textarea"
          /></section
      ></el-tab-pane>
      <el-tab-pane :label="content.staff.title.zh || '优秀员工'" name="staff"
        ><ModuleSectionHeader
          v-model:enabled="content.staff.enabled"
          v-model:title="content.staff.title"
          :title-placeholders="[
            '中文模块标题',
            'English section title',
            'Русский заголовок раздела'
          ]"
          :can-manage="canManage"
          add-text="新增员工"
          @add="add('staff')"
          @clear="clearModule('staff')" />
        <el-empty
          v-if="!content.staff.items.length"
          description="暂无员工卡片。" />
        <section
          v-for="(item, index) in content.staff.items"
          :key="index"
          class="editor-card"
        >
          <ItemActions
            :index="index"
            :total="content.staff.items.length"
            :can-manage="canManage"
            @move="move(content.staff.items, index, $event)"
            @remove="remove(content.staff.items, index, '员工卡片')"
          />
          <MediaPicker
            v-model="item.imageMediaId"
            :asset="asset(item.imageMediaId)"
            :disabled="!canManage"
            @select="rememberAssets"
          />
          <LocalizedInputs
            v-model="item.name"
            :placeholders="['中文姓名', 'English name', 'Русское имя']"
          />
          <LocalizedInputs
            v-model="item.role"
            :placeholders="['中文职位', 'English role', 'Русская должность']"
          />
          <LocalizedInputs
            v-model="item.description"
            :placeholders="['中文简介', 'English bio', 'Русское описание']"
            input-type="textarea"
          /></section
      ></el-tab-pane>
      <el-tab-pane label="视频" name="videos"
        ><ModuleSectionHeader
          v-model:enabled="content.videos.enabled"
          v-model:title="content.videos.title"
          :title-placeholders="[
            '中文模块标题',
            'English section title',
            'Русский заголовок раздела'
          ]"
          :can-manage="canManage"
          add-text="新增视频"
          @add="add('videos')"
          @clear="clearModule('videos')" />
        <el-empty
          v-if="!content.videos.items.length"
          description="暂无视频。" />
        <section
          v-for="(item, index) in content.videos.items"
          :key="index"
          class="editor-card"
        >
          <ItemActions
            :index="index"
            :total="content.videos.items.length"
            :can-manage="canManage"
            @move="move(content.videos.items, index, $event)"
            @remove="remove(content.videos.items, index, '视频')"
          />
          <label
            >视频<MediaPicker
              v-model="item.videoMediaId"
              mime-group="video"
              :asset="asset(item.videoMediaId)"
              :disabled="!canManage"
              @select="rememberAssets" /></label
          ><label
            >封面<MediaPicker
              v-model="item.posterMediaId"
              :asset="asset(item.posterMediaId)"
              :disabled="!canManage"
              @select="rememberAssets"
          /></label>
          <LocalizedInputs
            v-model="item.title"
            :placeholders="['中文标题', 'English title', 'Русский заголовок']"
          /></section
      ></el-tab-pane>
      <el-tab-pane label="快捷导航" name="quickNav"
        ><ModuleSectionHeader
          v-model:enabled="content.quickNav.enabled"
          v-model:title="content.quickNav.title"
          :title-placeholders="[
            '中文模块标题',
            'English section title',
            'Русский заголовок раздела'
          ]"
          :can-manage="canManage"
          add-text="新增链接"
          @add="add('quickNav')"
          @clear="clearModule('quickNav')" />
        <el-empty
          v-if="!content.quickNav.items.length"
          description="暂无快捷导航链接。" />
        <section
          v-for="(item, index) in content.quickNav.items"
          :key="index"
          class="editor-card"
        >
          <ItemActions
            :index="index"
            :total="content.quickNav.items.length"
            :can-manage="canManage"
            @move="move(content.quickNav.items, index, $event)"
            @remove="remove(content.quickNav.items, index, '快捷导航链接')"
          />
          <el-switch
            v-model="item.enabled"
            :disabled="!canManage"
            active-text="显示"
            inactive-text="隐藏"
          /><el-input
            v-model="item.href"
            placeholder="#about、/contact 或 https://example.com"
          />
          <LocalizedInputs
            v-model="item.label"
            :placeholders="['中文名称', 'English label', 'Русское название']"
          /></section
      ></el-tab-pane>
      <el-tab-pane label="办公室与停车场" name="locations"
        ><ModuleSectionHeader
          v-model:enabled="content.locations.enabled"
          v-model:title="content.locations.title"
          :title-placeholders="[
            '中文模块标题',
            'English section title',
            'Русский заголовок раздела'
          ]"
          :can-manage="canManage"
          add-text="新增地点"
          @add="add('locations')"
          @clear="clearModule('locations')" />
        <el-empty
          v-if="!content.locations.items.length"
          description="暂无办公室或停车场地点。" />
        <section
          v-for="(item, index) in content.locations.items"
          :key="index"
          class="editor-card"
        >
          <ItemActions
            :index="index"
            :total="content.locations.items.length"
            :can-manage="canManage"
            @move="move(content.locations.items, index, $event)"
            @remove="remove(content.locations.items, index, '地点')"
          />
          <el-switch
            v-model="item.enabled"
            :disabled="!canManage"
            active-text="显示"
            inactive-text="隐藏"
          /><el-select v-model="item.type"
            ><el-option label="办公室" value="OFFICE" /><el-option
              label="停车场"
              value="PARKING" /></el-select
          ><el-input v-model="item.mapUrl" placeholder="地图链接（可选）" />
          <LocalizedInputs
            v-model="item.name"
            :placeholders="['中文名称', 'English name', 'Русское название']"
          />
          <LocalizedInputs
            v-model="item.address"
            :placeholders="['中文地址', 'English address', 'Русский адрес']"
          /></section
      ></el-tab-pane>
      <el-tab-pane label="自定义模块" name="custom">
        <CustomModulesTab
          :items="content.customModules"
          :can-manage="canManage"
          :asset="asset"
          :remember-assets="rememberAssets"
          @add="add('custom')"
          @clear="clearModule('custom')"
          @move="move(content.customModules, $event.index, $event.direction)"
          @remove="remove(content.customModules, $event, '自定义模块')"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.load-error {
  display: grid;
  gap: 12px;
  justify-items: start;
}

:deep(.editor-card) {
  position: relative;
  display: grid;
  gap: 12px;
  padding: 18px;
  margin-top: 14px;
  border: 1px solid var(--ops-line);
  border-radius: 6px;
}

:deep(.editor-card label) {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

:deep(.editor-card h3) {
  margin: 0;
  font-size: 14px;
}

:deep(.section-heading) {
  display: grid;
  gap: 14px;
}

:deep(.module-actions) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

:deep(.module-hint) {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

:deep(.module-display-controls) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.is-readonly :deep(.el-tab-pane .el-input__wrapper),
.is-readonly :deep(.el-tab-pane .el-select),
.is-readonly :deep(.el-tab-pane .el-switch),
.is-readonly :deep(.el-tab-pane .media-picker) {
  pointer-events: none;
}

@media (width <= 760px) {
  :deep(.module-display-controls) {
    grid-template-columns: 1fr;
  }
}
</style>
