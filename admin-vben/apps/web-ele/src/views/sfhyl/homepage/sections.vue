<script setup lang="ts">
import type { Vehicle } from "@/types/business";

import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";

import {
  createRecommendation,
  deleteRecommendation,
  getHomepagePreview,
  getRecommendations,
  getSections,
  type HomepageRecord,
  sortRecommendations,
  sortSections,
  updateRecommendation,
  updateSection
} from "@/api/homepage";
import { getVehicles } from "@/api/vehicles";
import MediaPicker from "@/components/MediaPicker/index.vue";
import PageLoadState from "@/components/PageLoadState/index.vue";
import { usePageLoad } from "@/composables/usePageLoad";
import { showActionError } from "@/utils/action-feedback";
import { hasPerms } from "@/utils/auth";
import { confirmAction } from "@/utils/confirm-action";
import { resolveMediaUrl } from "@/utils/media";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";

import { selectHomepageVehicles } from "../../../../../../../shared/homepage-vehicles";

defineOptions({ name: "HomepageSections" });
const route = useRoute();
const sections = ref<HomepageRecord[]>([]);
const recommendations = ref<HomepageRecord[]>([]);
const vehicles = ref<Vehicle[]>([]);
const homepagePreview = ref<{ vehicles: Vehicle[]; source: string; enabled: boolean }>({ vehicles: [], source: "automatic", enabled: true });
const previewSources: Record<string, string> = { configured: "推荐配置", featured: "车辆推荐标记", automatic: "自动展示已发布车辆" };
const { loading, loadError, runLoad } = usePageLoad();
const sectionOpen = ref(false);
const recommendationOpen = ref(false);
const saving = ref(false);
const editId = ref("");
const sectionForm = reactive({
  titleZh: "",
  titleEn: "",
  subtitleZh: "",
  subtitleEn: "",
  descriptionZh: "",
  descriptionEn: "",
  backgroundMediaId: null as null | string,
  displayCount: 8,
  sortOrder: 0,
  isEnabled: true,
  styleKey: "default",
  configText: "{}"
});
const recommendationForm = reactive({
  homepageSectionId: "",
  vehicleId: "",
  label: "",
  startsAt: "",
  endsAt: "",
  sortOrder: 0,
  isEnabled: true
});
const typeNames: Record<string, string> = {
  BANNER: "轮播图",
  VEHICLE_SEARCH: "车辆搜索",
  FEATURED_VEHICLES: "推荐车辆",
  LATEST_VEHICLES: "最新车辆",
  NEW_VEHICLES: "新车专区",
  USED_VEHICLES: "二手车专区",
  BRANDS: "品牌展示",
  FEATURES: "公司优势",
  ABOUT: "公司介绍",
  VIDEO: "宣传视频",
  TESTIMONIALS: "客户评价",
  CONTACT: "联系我们",
  CTA: "行动按钮"
};
const view = computed(() => route.meta.homepageView || "modules");
const pageCopy = computed(() => {
  const copy = {
    modules: ["首页模块", "控制首页模块顺序、标题和展示状态"],
    recommendations: ["推荐车辆", "管理首页推荐车辆、顺序和有效期"],
    brands: ["品牌展示", "配置首页品牌展示模块"],
    video: ["首页视频", "配置首页宣传视频模块"],
    about: ["公司简介", "配置首页公司介绍模块"],
    cta: ["行动按钮", "配置首页行动按钮模块"]
  } as const;
  return copy[view.value];
});
const visibleSections = computed(() => {
  const filters = {
    brands: "BRANDS",
    video: "VIDEO",
    about: "ABOUT",
    cta: "CTA"
  } as const;
  const type = filters[view.value as keyof typeof filters];
  return type
    ? sections.value.filter(item => item.type === type)
    : sections.value;
});
async function load() {
  await runLoad(async () => {
    [sections.value, recommendations.value] = await Promise.all([
      getSections(),
      getRecommendations()
    ]);
    if (view.value === "recommendations") {
      const preview = await getHomepagePreview();
      homepagePreview.value = selectHomepageVehicles(preview.sections, preview.vehicles);
    }
  });
}
function editSection(row: HomepageRecord) {
  editId.value = row.id;
  Object.assign(sectionForm, {
    titleZh: row.titleZh || "",
    titleEn: row.titleEn || "",
    subtitleZh: row.subtitleZh || "",
    subtitleEn: row.subtitleEn || "",
    descriptionZh: row.descriptionZh || "",
    descriptionEn: row.descriptionEn || "",
    backgroundMediaId: row.backgroundMediaId || null,
    displayCount: row.displayCount || 8,
    sortOrder: row.sortOrder || 0,
    isEnabled: row.isEnabled,
    styleKey: row.styleKey || "default",
    configText: JSON.stringify(row.config || {}, null, 2)
  });
  sectionOpen.value = true;
}
async function saveSection() {
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(sectionForm.configText || "{}") as Record<
      string,
      unknown
    >;
  } catch {
    ElMessage.error("模块配置必须是有效 JSON");
    return;
  }
  saving.value = true;
  try {
    const { configText, ...data } = sectionForm;
    await updateSection(editId.value, { ...data, config });
    ElMessage.success("首页模块已保存");
    sectionOpen.value = false;
    await load();
  } catch (error) {
    showActionError(error);
  } finally {
    saving.value = false;
  }
}
async function moveSection(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= sections.value.length) return;
  const next = [...sections.value];
  [next[index], next[target]] = [next[target]!, next[index]!];
  await sortSections(
    next.map((item, sortOrder) => ({ id: item.id, sortOrder }))
  );
  await load();
}
async function openRecommendation(row?: HomepageRecord, vehicleId?: string) {
  editId.value = row?.id || "";
  if (!vehicles.value.length)
    vehicles.value = (
      await getVehicles({ page: 1, pageSize: 100, deleted: "false" })
    ).items;
  Object.assign(recommendationForm, {
    homepageSectionId:
      row?.homepageSectionId ||
      sections.value.find(item => item.type === "FEATURED_VEHICLES")?.id ||
      "",
    vehicleId: row?.vehicleId || vehicleId || "",
    label: row?.label || "",
    startsAt: row?.startsAt
      ? dayjs(row.startsAt).format("YYYY-MM-DDTHH:mm:ss")
      : "",
    endsAt: row?.endsAt ? dayjs(row.endsAt).format("YYYY-MM-DDTHH:mm:ss") : "",
    sortOrder: row?.sortOrder || recommendations.value.length,
    isEnabled: row?.isEnabled ?? true
  });
  recommendationOpen.value = true;
}
function configurePreviewVehicle(vehicle: Vehicle): void {
  void openRecommendation(recommendations.value.find(item => item.vehicleId === vehicle.id), vehicle.id);
}
async function saveRecommendation() {
  if (!recommendationForm.homepageSectionId || !recommendationForm.vehicleId) {
    ElMessage.warning("请选择首页模块和车辆");
    return;
  }
  saving.value = true;
  try {
    const data = Object.fromEntries(
      Object.entries(recommendationForm).map(([k, v]) => [
        k,
        v === "" ? null : v
      ])
    );
    editId.value
      ? await updateRecommendation(editId.value, data)
      : await createRecommendation(data);
    ElMessage.success("推荐车辆已保存");
    recommendationOpen.value = false;
    await load();
  } catch (error) {
    showActionError(error);
  } finally {
    saving.value = false;
  }
}
async function removeRecommendation(row: HomepageRecord) {
  if (!(await confirmAction("确认移除该推荐车辆？", "移除确认"))) return;
  await deleteRecommendation(row.id);
  await load();
}
async function moveRecommendation(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= recommendations.value.length) return;
  const next = [...recommendations.value];
  [next[index], next[target]] = [next[target]!, next[index]!];
  await sortRecommendations(
    next.map((item, sortOrder) => ({ id: item.id, sortOrder }))
  );
  await load();
}
onMounted(load);
watch(view, () => void load());
</script>
<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>{{ pageCopy[0] }}</h1>
        <p>{{ pageCopy[1] }}</p>
      </div>
      <el-button
        v-if="view === 'recommendations' && hasPerms('homepage:manage')"
        type="primary"
        @click="openRecommendation()"
        >
<IconifyIconOnline icon="ri:add-line" />添加推荐车辆
</el-button>
    </div>
    <PageLoadState :loading="loading" :error="loadError" :ready="sections.length > 0" @retry="load" />
    <section v-if="view !== 'recommendations'" class="form-section">
      <h2>模块列表</h2>
      <div v-show="!loadError && (!loading || sections.length > 0)" class="table-wrap">
        <el-table v-loading="loading" :data="visibleSections">
<el-table-column label="模块" min-width="150">
<template #default="{ row = {} } = {}">
<strong>{{ typeNames[row.type] || row.type }}</strong>
              <div class="subline">{{ row.key }}</div>
</template>
</el-table-column><el-table-column label="标题" min-width="180">
<template #default="{ row = {} } = {}">
{{
              row.titleZh || "未设置"
            }}
</template>
</el-table-column><el-table-column
            prop="displayCount"
            label="显示数量"
            width="90"
          /><el-table-column label="状态" width="80">
<template #default="{ row = {} } = {}">
<el-tag
                :type="row.isEnabled ? 'success' : 'info'"
                size="small"
                >
{{ row.isEnabled ? "显示" : "隐藏" }}
</el-tag>
</template>
</el-table-column><el-table-column
            v-if="view === 'modules' && hasPerms('homepage:manage')"
            label="排序"
            width="110"
            >
<template #default="{ $index = 0 } = {}">
<el-button
                circle
                text
                :disabled="$index === 0"
                @click="moveSection($index, -1)"
                >
<IconifyIconOnline icon="ri:arrow-up-line" />
</el-button><el-button
                circle
                text
                :disabled="$index === sections.length - 1"
                @click="moveSection($index, 1)"
                >
<IconifyIconOnline
                  icon="ri:arrow-down-line"
/>
</el-button>
</template>
</el-table-column><el-table-column
            v-if="hasPerms('homepage:manage')"
            label="操作"
            width="90"
            >
<template #default="{ row = {} } = {}">
<el-button
                link
                type="primary"
                @click="editSection(row as HomepageRecord)"
                >
配置
</el-button>
</template>
</el-table-column>
</el-table>
      </div>
    </section>
    <section v-if="view === 'recommendations'" class="form-section">
      <div class="section-title">
        <h2>官网当前展示车辆</h2>
        <span>{{ homepagePreview.vehicles.length }} 辆 · {{ previewSources[homepagePreview.source] }}</span>
      </div>
      <div v-show="!loadError && (!loading || sections.length > 0)" class="table-wrap homepage-preview-table">
        <el-table :data="homepagePreview.vehicles" v-loading="loading">
          <el-table-column label="车辆" min-width="240">
            <template #default="{ row }">
              <div class="vehicle-cell">
                <el-image :src="resolveMediaUrl(row.coverMedia?.webpUrl || row.coverMedia?.url)" fit="cover" />
                <div><strong>{{ row.nameZh || row.nameEn || row.nameRu }}</strong><div class="subline">{{ row.stockNo }}</div></div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="来源" min-width="160"><template #default>{{ previewSources[homepagePreview.source] }}</template></el-table-column>
          <el-table-column v-if="hasPerms('homepage:manage')" label="操作" width="130">
            <template #default="{ row }"><el-button link type="primary" @click="configurePreviewVehicle(row as Vehicle)">配置推荐</el-button></template>
          </el-table-column>
          <template #empty><el-empty :description="homepagePreview.enabled ? '暂无可展示的已发布车辆' : '首页推荐模块已停用'" /></template>
        </el-table>
      </div>
      <div class="section-title">
        <h2>推荐配置</h2>
        <span>{{ recommendations.length }} 项</span>
      </div>
      <div v-show="!loadError && (!loading || sections.length > 0)" class="table-wrap">
        <el-table :data="recommendations">
<el-table-column label="车辆" min-width="240">
<template #default="{ row = {} } = {}">
<div class="vehicle-cell">
                <el-image
                  :src="resolveMediaUrl(row.vehicle?.coverMedia?.url)"
                  fit="cover"
                />
                <div>
                  <strong>{{ row.vehicle?.nameZh }}</strong>
                  <div class="subline">{{ row.vehicle?.stockNo }}</div>
                </div>
              </div>
</template>
</el-table-column><el-table-column
            prop="label"
            label="推荐标签"
            width="130"
          /><el-table-column label="有效期" min-width="190">
<template #default="{ row = {} } = {}">
{{
                row.startsAt ? dayjs(row.startsAt).format("YYYY-MM-DD") : "立即"
              }}
              至
              {{
                row.endsAt ? dayjs(row.endsAt).format("YYYY-MM-DD") : "长期"
              }}
</template>
</el-table-column><el-table-column label="状态" width="80">
<template #default="{ row = {} } = {}">
<el-tag
                :type="row.isEnabled ? 'success' : 'info'"
                size="small"
                >
{{ row.isEnabled ? "启用" : "停用" }}
</el-tag>
</template>
</el-table-column><el-table-column
            v-if="hasPerms('homepage:manage')"
            label="排序"
            width="110"
            >
<template #default="{ $index = 0 } = {}">
<el-button
                circle
                text
                :disabled="$index === 0"
                @click="moveRecommendation($index, -1)"
                >
<IconifyIconOnline icon="ri:arrow-up-line" />
</el-button><el-button
                circle
                text
                :disabled="$index === recommendations.length - 1"
                @click="moveRecommendation($index, 1)"
                >
<IconifyIconOnline
                  icon="ri:arrow-down-line"
/>
</el-button>
</template>
</el-table-column><el-table-column
            v-if="hasPerms('homepage:manage')"
            label="操作"
            width="130"
            >
<template #default="{ row = {} } = {}">
<el-button
                link
                type="primary"
                @click="openRecommendation(row as HomepageRecord)"
                >
编辑
</el-button><el-button
                link
                type="danger"
                @click="removeRecommendation(row as HomepageRecord)"
                >
移除
</el-button>
</template>
</el-table-column>
</el-table>
      </div>
    </section>
    <el-dialog
      v-model="sectionOpen"
      title="配置首页模块"
      width="min(720px,94vw)"
      >
<el-form label-position="top">
<div class="dialog-grid">
          <el-form-item label="中文标题">
<el-input v-model="sectionForm.titleZh" />
</el-form-item><el-form-item label="英文标题">
<el-input v-model="sectionForm.titleEn" />
</el-form-item><el-form-item label="中文副标题">
<el-input v-model="sectionForm.subtitleZh" />
</el-form-item><el-form-item label="英文副标题">
<el-input v-model="sectionForm.subtitleEn" />
</el-form-item><el-form-item label="背景图片">
<MediaPicker
              v-model="sectionForm.backgroundMediaId"
/>
</el-form-item><el-form-item label="显示数量">
<el-input-number
              v-model="sectionForm.displayCount"
              :min="1"
              :max="100"
/>
</el-form-item><el-form-item label="样式标识">
<el-input v-model="sectionForm.styleKey" />
</el-form-item><el-form-item label="是否显示">
<el-switch v-model="sectionForm.isEnabled" />
</el-form-item><el-form-item label="中文说明" class="span-2">
<el-input
              v-model="sectionForm.descriptionZh"
              type="textarea"
/>
</el-form-item><el-form-item label="模块配置 JSON" class="span-2">
<el-input
              v-model="sectionForm.configText"
              type="textarea"
              :rows="6"
          />
</el-form-item>
</div>
</el-form><template #footer>
<el-button @click="sectionOpen = false">取消</el-button><el-button
          v-if="hasPerms('homepage:manage')"
          type="primary"
          :loading="saving"
          @click="saveSection"
          >
保存
</el-button>
</template>
</el-dialog>
    <el-dialog
      v-model="recommendationOpen"
      :title="editId ? '编辑推荐' : '添加推荐'"
      width="min(620px,94vw)"
      >
<el-form label-position="top">
<div class="dialog-grid">
          <el-form-item label="推荐模块" required>
<el-select v-model="recommendationForm.homepageSectionId">
<el-option
                v-for="item in sections"
                v-show="item.type === 'FEATURED_VEHICLES'"
                :key="item.id"
                :label="typeNames[item.type || ''] || item.type"
                :value="item.id"
/>
</el-select>
</el-form-item><el-form-item label="车辆" required>
<el-select v-model="recommendationForm.vehicleId" filterable>
<el-option
                v-for="item in vehicles"
                :key="item.id"
                :label="`${item.nameZh} / ${item.stockNo}`"
                :value="item.id"
/>
</el-select>
</el-form-item><el-form-item label="推荐标签">
<el-input v-model="recommendationForm.label" />
</el-form-item><el-form-item label="是否启用">
<el-switch v-model="recommendationForm.isEnabled" />
</el-form-item><el-form-item label="开始时间">
<el-date-picker
              v-model="recommendationForm.startsAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
/>
</el-form-item><el-form-item label="结束时间">
<el-date-picker
              v-model="recommendationForm.endsAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
          />
</el-form-item>
</div>
</el-form><template #footer>
<el-button @click="recommendationOpen = false">取消</el-button><el-button
          v-if="hasPerms('homepage:manage')"
          type="primary"
          :loading="saving"
          @click="saveRecommendation"
          >
保存
</el-button>
</template>
</el-dialog>
  </div>
</template>
<style scoped>
.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.span-2 {
  grid-column: span 2;
}

.subline {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ops-muted);
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title h2 {
  margin: 0;
}

.section-title span {
  font-size: 13px;
  color: var(--ops-muted);
}

.vehicle-cell {
  display: flex;
  gap: 12px;
  align-items: center;
}

.vehicle-cell .el-image {
  width: 64px;
  height: 42px;
  border-radius: 4px;
}

@media (width <= 620px) {
  .dialog-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
