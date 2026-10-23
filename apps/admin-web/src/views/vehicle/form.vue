<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import dayjs from "dayjs";
import MediaPicker from "@/components/MediaPicker/index.vue";
import VideoThumbnail from "@/components/VideoThumbnail/index.vue";
import { resolveMediaUrl } from "@/utils/media";
import {
  getBrands,
  getCategories,
  getModels,
  getSeries,
  getTags,
  createQuickBrand
} from "@/api/catalog";
import { createVehicle, getVehicle, updateVehicle } from "@/api/vehicles";
import type {
  Brand,
  Vehicle,
  VehicleCategory,
  VehicleModel,
  VehicleSeries,
  VehicleTag
} from "@/types/business";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { vehiclePricePattern } from "@/validation/business";
import { getRequestErrorMessage } from "@/utils/http/error-message";
import { useVehicleMediaEditor } from "./useVehicleMediaEditor";
import VehicleBasicInfoTab from "./VehicleBasicInfoTab.vue";
import VehicleContentTab from "./VehicleContentTab.vue";
import VehicleSpecsTab from "./VehicleSpecsTab.vue";
import { createVehicleFormModel } from "./vehicle-form.model";

defineOptions({ name: "VehicleForm" });

const route = useRoute();
const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);
const isDirty = ref(false);
const trackChanges = ref(false);
const activeTab = ref("basic");
const brands = ref<Brand[]>([]);
const brandQuery = ref("");
const creatingBrand = ref(false);
const series = ref<VehicleSeries[]>([]);
const models = ref<VehicleModel[]>([]);
const categories = ref<VehicleCategory[]>([]);
const tags = ref<VehicleTag[]>([]);
const {
  isAutoCover,
  mediaListRef,
  mediaRows,
  mediaUrl,
  moveMedia,
  removeMedia,
  rememberSelectedMedia,
  replaceMedia,
  selectedMediaIds
} = useVehicleMediaEditor();
const highlightsText = ref("");
const specificationsText = ref("{}");
const editingId = computed(() => String(route.params.id || ""));
const isEditing = computed(() => Boolean(editingId.value));
const createBrandOptionPrefix = "__create_brand__:";
const filteredBrands = computed(() => {
  const keyword = normalizeBrandName(brandQuery.value).toLocaleLowerCase();
  if (!keyword) return brands.value;
  return brands.value.filter(brand =>
    [brand.nameZh, brand.nameEn, brand.nameRu || ""].some(name =>
      name.toLocaleLowerCase().includes(keyword)
    )
  );
});
const brandNameToCreate = computed(() => {
  const name = normalizeBrandName(brandQuery.value);
  if (!name) return "";
  const normalized = name.toLocaleLowerCase();
  return brands.value.some(brand =>
    [brand.nameZh, brand.nameEn, brand.nameRu || ""].some(
      item => normalizeBrandName(item).toLocaleLowerCase() === normalized
    )
  )
    ? ""
    : name;
});
const createBrandOptionValue = computed(() =>
  brandNameToCreate.value
    ? `${createBrandOptionPrefix}${brandNameToCreate.value}`
    : ""
);
useUnsavedChanges(isDirty);

const form = reactive(createVehicleFormModel());

const rules: FormRules = {
  nameZh: [{ required: true, message: "请输入车辆名称", trigger: "blur" }],
  brandId: [{ required: true, message: "请选择品牌", trigger: "change" }],
  year: [{ required: true, message: "请输入年份", trigger: "change" }],
  price: [
    {
      pattern: vehiclePricePattern,
      message: "请输入有效价格",
      trigger: "blur"
    }
  ]
};

function markDirty(): void {
  if (trackChanges.value) isDirty.value = true;
}

watch(form, markDirty, { deep: true });
watch(highlightsText, markDirty);
watch(specificationsText, markDirty);
watch(mediaRows, markDirty, { deep: true });

function normalizeBrandName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function resetBrandRelations(): void {
  form.seriesId = "";
  form.modelId = "";
  series.value = [];
  models.value = [];
}

function filterBrands(query: string): void {
  brandQuery.value = query;
}

function handleBrandDropdownVisibleChange(visible: boolean): void {
  if (!visible) brandQuery.value = "";
}

async function handleBrandChange(value: string | undefined): Promise<void> {
  const selection = String(value || "");
  brandQuery.value = "";
  if (!selection) {
    resetBrandRelations();
    return;
  }

  if (brands.value.some(brand => brand.id === selection)) {
    await loadSeries(true);
    return;
  }

  const name = normalizeBrandName(
    selection.startsWith(createBrandOptionPrefix)
      ? selection.slice(createBrandOptionPrefix.length)
      : selection
  );
  if (!name) {
    form.brandId = "";
    resetBrandRelations();
    return;
  }

  creatingBrand.value = true;
  try {
    const brand = await createQuickBrand(name);
    if (!brands.value.some(item => item.id === brand.id)) {
      brands.value = [...brands.value, brand].sort((left, right) =>
        left.nameEn.localeCompare(right.nameEn)
      );
    }
    form.brandId = brand.id;
    await loadSeries(true);
    ElMessage.success(`品牌“${brand.nameZh}”已可使用`);
  } catch (error) {
    form.brandId = "";
    resetBrandRelations();
    throw error;
  } finally {
    creatingBrand.value = false;
  }
}

async function loadSeries(reset = true): Promise<void> {
  if (reset) {
    form.seriesId = "";
    form.modelId = "";
  }
  series.value = form.brandId
    ? ((await getSeries({ brandId: form.brandId })) as VehicleSeries[])
    : [];
  await loadModels(reset);
}

async function loadModels(reset = true): Promise<void> {
  if (reset) form.modelId = "";
  models.value = form.seriesId
    ? ((await getModels({
        brandId: form.brandId,
        seriesId: form.seriesId
      })) as VehicleModel[])
    : [];
}

function cleanPayload(): Record<string, unknown> {
  let specifications: Record<string, unknown> = {};
  try {
    specifications = JSON.parse(specificationsText.value || "{}") as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error("车辆配置必须是有效的 JSON 对象");
  }
  const payload = Object.fromEntries(
    Object.entries(form).filter(
      ([, value]) => value !== "" && value !== undefined
    )
  );
  return {
    ...payload,
    seriesId: form.seriesId || null,
    modelId: form.modelId || null,
    categoryId: form.categoryId || null,
    highlights: highlightsText.value
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean),
    specifications,
    // Preview-only fields such as URL and thumbnailUrl are not part of the API DTO.
    media: mediaRows.value.map((item, index) => ({
      mediaId: item.mediaId,
      sortOrder: index
    }))
  };
}

async function save(publish = false): Promise<void> {
  if (saving.value) return;
  if (creatingBrand.value) {
    ElMessage.warning("品牌正在创建，请稍候");
    return;
  }
  saving.value = true;
  try {
    const valid = await formRef.value?.validate().catch(() => false);
    if (!valid) {
      activeTab.value = "basic";
      return;
    }
    const payload = { ...cleanPayload(), publishNow: publish };
    const vehicle = isEditing.value
      ? await updateVehicle(editingId.value, payload)
      : await createVehicle(payload);
    ElMessage.success(publish ? "车辆已发布" : "车辆已保存");
    isDirty.value = false;
    await router.push(
      vehicle.type === "NEW" ? "/vehicles/new" : "/vehicles/used"
    );
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error));
  } finally {
    saving.value = false;
  }
}

function assignVehicle(vehicle: Vehicle): void {
  for (const key of Object.keys(form) as Array<keyof typeof form>) {
    const value = vehicle[key];
    if (value !== null && value !== undefined && typeof value !== "object")
      (form[key] as unknown) = value;
  }
  form.brandId = vehicle.brandId || vehicle.brand.id;
  form.seriesId = vehicle.seriesId || "";
  form.modelId = vehicle.modelId || "";
  form.categoryId = vehicle.categoryId || "";
  form.tagIds = vehicle.tags?.map(item => item.tagId) || [];
  form.manufactureDate = vehicle.manufactureDate
    ? dayjs(String(vehicle.manufactureDate)).format("YYYY-MM-DD")
    : "";
  form.registrationDate = vehicle.registrationDate
    ? dayjs(String(vehicle.registrationDate)).format("YYYY-MM-DD")
    : "";
  highlightsText.value = Array.isArray(vehicle.highlights)
    ? vehicle.highlights.join("\n")
    : "";
  specificationsText.value = JSON.stringify(
    vehicle.specifications || {},
    null,
    2
  );
  mediaRows.value = (vehicle.media || []).map(item => ({
    mediaId: item.mediaId,
    sortOrder: item.sortOrder,
    url: mediaUrl(item.media),
    thumbnailUrl: item.media.thumbnailUrl
      ? resolveMediaUrl(item.media.thumbnailUrl)
      : undefined,
    mimeType: item.media.mimeType
  }));
  rememberSelectedMedia((vehicle.media || []).map(item => item.media));
  selectedMediaIds.value = mediaRows.value.map(item => item.mediaId);
}

onMounted(async () => {
  loading.value = true;
  try {
    [brands.value, categories.value, tags.value] = await Promise.all([
      getBrands() as Promise<Brand[]>,
      getCategories() as Promise<VehicleCategory[]>,
      getTags() as Promise<VehicleTag[]>
    ]);
    if (isEditing.value) {
      const vehicle = await getVehicle(editingId.value);
      assignVehicle(vehicle);
      await loadSeries(false);
      await loadModels(false);
    }
    await nextTick();
    trackChanges.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-loading="loading" class="admin-page vehicle-form-page">
    <div class="page-heading">
      <div>
        <h1>{{ isEditing ? "编辑车辆" : "新增车辆" }}</h1>
        <p>车辆资料与展示素材</p>
      </div>
      <el-button @click="router.push('/vehicles/list')"
        ><IconifyIconOnline icon="ri:arrow-left-line" />返回列表</el-button
      >
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-tabs v-model="activeTab" class="form-tabs">
        <el-tab-pane label="基础信息" name="basic">
          <VehicleBasicInfoTab
            v-model:form="form"
            :filtered-brands="filteredBrands"
            :series="series"
            :models="models"
            :categories="categories"
            :tags="tags"
            :creating-brand="creatingBrand"
            :brand-name-to-create="brandNameToCreate"
            :create-brand-option-value="createBrandOptionValue"
            @filter-brands="filterBrands"
            @brand-dropdown-visible-change="handleBrandDropdownVisibleChange"
            @brand-change="handleBrandChange"
            @series-change="loadModels(true)"
          />
        </el-tab-pane>

        <el-tab-pane label="价格与参数" name="specs">
          <VehicleSpecsTab v-model:form="form" />
        </el-tab-pane>

        <el-tab-pane label="展示内容" name="content">
          <VehicleContentTab
            v-model:form="form"
            v-model:highlights-text="highlightsText"
            v-model:specifications-text="specificationsText"
          />
        </el-tab-pane>

        <el-tab-pane label="媒体素材" name="media">
          <section class="form-section">
            <div class="section-title">
              <h2>车辆图片与视频</h2>
              <MediaPicker
                v-model="selectedMediaIds"
                multiple
                mime-group="all"
                allow-upload
                @select="rememberSelectedMedia"
              />
            </div>
            <el-empty v-if="!mediaRows.length" description="尚未选择素材" />
            <div v-else ref="mediaListRef" class="media-editor-list">
              <div
                v-for="(item, index) in mediaRows"
                :key="item.mediaId"
                class="media-editor-row"
                :data-media-id="item.mediaId"
              >
                <el-tooltip content="拖动排序">
                  <button
                    type="button"
                    class="media-drag-handle"
                    aria-label="拖动排序"
                  >
                    <IconifyIconOnline icon="ri:draggable" />
                  </button>
                </el-tooltip>
                <img
                  v-if="item.url && !item.mimeType?.startsWith('video/')"
                  :src="item.url"
                  alt=""
                />
                <VideoThumbnail
                  v-else-if="item.url && item.mimeType?.startsWith('video/')"
                  class="vehicle-video-preview"
                  :src="item.url"
                  :poster="item.thumbnailUrl"
                  label="车辆视频"
                />
                <div v-else class="media-id">#{{ item.mediaId }}</div>
                <div class="media-actions">
                  <el-tag v-if="isAutoCover(item)" type="primary" effect="dark"
                    >封面</el-tag
                  >
                  <MediaPicker
                    :model-value="item.mediaId"
                    mime-group="all"
                    allow-upload
                    @select="replaceMedia(index, $event)"
                  >
                    <template #trigger="{ open }">
                      <el-tooltip content="替换素材">
                        <el-button circle aria-label="替换素材" @click="open">
                          <IconifyIconOnline icon="ri:swap-line" />
                        </el-button>
                      </el-tooltip>
                    </template>
                  </MediaPicker>
                  <el-button
                    circle
                    aria-label="上移素材"
                    :disabled="index === 0"
                    @click="moveMedia(index, -1)"
                    ><IconifyIconOnline icon="ri:arrow-up-line" /></el-button
                  ><el-button
                    circle
                    aria-label="下移素材"
                    :disabled="index === mediaRows.length - 1"
                    @click="moveMedia(index, 1)"
                    ><IconifyIconOnline icon="ri:arrow-down-line" /></el-button
                  ><el-button
                    circle
                    type="danger"
                    aria-label="移除素材"
                    @click="removeMedia(item.mediaId)"
                    ><IconifyIconOnline icon="ri:delete-bin-line"
                  /></el-button>
                </div>
              </div>
            </div>
          </section>
        </el-tab-pane>
      </el-tabs>
    </el-form>

    <div class="sticky-actions">
      <span>必填内容完成后可保存草稿或直接发布</span>
      <div>
        <el-button
          :loading="saving || creatingBrand"
          :disabled="creatingBrand"
          @click="save(false)"
          ><IconifyIconOnline icon="ri:save-line" />保存</el-button
        ><el-button
          type="primary"
          :loading="saving || creatingBrand"
          :disabled="creatingBrand"
          @click="save(true)"
          ><IconifyIconOnline icon="ri:send-plane-line" />保存并发布</el-button
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.vehicle-form-page {
  padding-bottom: 74px;
}

.form-tabs {
  min-width: 0;
}

:deep(.form-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 18px;
}

:deep(.form-grid.one-column) {
  grid-template-columns: minmax(0, 920px);
}

:deep(.unit-select) {
  width: 92px;
  margin-left: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title h2 {
  margin: 0;
}

.media-editor-list {
  display: grid;
  gap: 8px;
}

.media-editor-row {
  display: grid;
  grid-template-columns: 26px 72px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--ops-line);
  border-radius: 6px;
}

.media-drag-handle {
  display: grid;
  place-items: center;
  width: 26px;
  height: 36px;
  padding: 0;
  color: var(--ops-muted);
  cursor: grab;
  background: transparent;
  border: 0;
}

.media-drag-handle:active {
  cursor: grabbing;
}

.media-editor-row.is-dragging {
  opacity: 0.55;
}

.media-editor-row img,
.media-id {
  display: grid;
  place-items: center;
  width: 72px;
  height: 52px;
  object-fit: cover;
  background: #eef0f2;
  border-radius: 4px;
}

.vehicle-video-preview {
  width: 72px;
  height: 52px;
}

.media-id {
  font-size: 12px;
  color: var(--ops-muted);
}

.media-actions {
  display: flex;
  gap: 5px;
}

.sticky-actions {
  position: fixed;
  right: 0;
  bottom: 0;
  left: var(--pure-layout-sidebar-width, 210px);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 10px 28px;
  color: var(--ops-muted);
  background: rgb(255 255 255 / 96%);
  border-top: 1px solid var(--ops-line);
  box-shadow: 0 -4px 16px rgb(23 32 42 / 6%);
}

:deep(.code-input textarea) {
  font-family: Consolas, monospace;
}

@media (width <= 1100px) {
  :deep(.form-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .media-editor-row {
    grid-template-columns: 26px 72px 1fr;
  }

  .media-actions {
    grid-column: 3;
  }
}

@media (width <= 760px) {
  :deep(.form-grid) {
    grid-template-columns: 1fr;
  }

  .media-editor-row {
    grid-template-columns: 26px 64px 1fr;
  }

  .media-editor-row > * {
    grid-column: 3;
  }

  .media-editor-row > .media-drag-handle {
    grid-row: 1 / 5;
    grid-column: 1;
  }

  .media-editor-row > img,
  .media-editor-row > .vehicle-video-preview,
  .media-editor-row > .media-id {
    grid-row: 1 / 5;
    grid-column: 2;
    width: 64px;
  }

  .media-actions {
    grid-column: 3;
  }

  .sticky-actions {
    left: 0;
    flex-wrap: wrap;
    padding: 8px 14px;
  }

  .sticky-actions span {
    display: none;
  }
}
</style>
