<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute } from "vue-router";
import MediaPicker from "@/components/MediaPicker/index.vue";
import {
  createCatalog,
  deleteCatalog,
  getBrands,
  getCategories,
  getModels,
  getSeries,
  getTags,
  updateCatalog
} from "@/api/catalog";
import { hasPerms } from "@/utils/auth";
import { resolveMediaUrl } from "@/utils/media";
import type {
  Brand,
  VehicleCategory,
  VehicleModel,
  VehicleSeries,
  VehicleTag
} from "@/types/business";

defineOptions({ name: "VehicleCatalog" });
type Kind = "brands" | "series" | "models" | "categories" | "tags";
type CatalogItem = (
  Brand | VehicleSeries | VehicleModel | VehicleCategory | VehicleTag
) &
  Record<string, unknown>;

const route = useRoute();
const active = ref<Kind>(route.meta.catalogKind || "brands");
const loading = ref(false);
const dialogOpen = ref(false);
const saving = ref(false);
const keyword = ref("");
const rows = ref<CatalogItem[]>([]);
const brands = ref<Brand[]>([]);
const seriesOptions = ref<VehicleSeries[]>([]);
const editingId = ref("");
const form = reactive({
  nameZh: "",
  brandId: "",
  seriesId: "",
  logoMediaId: null as string | null,
  country: "",
  descriptionZh: "",
  year: undefined as number | undefined,
  sortOrder: 0,
  color: "#C72C35",
  isEnabled: true,
  seoTitle: "",
  seoKeywords: "",
  seoDescription: ""
});

const titleMap: Record<Kind, string> = {
  brands: "品牌",
  series: "车系",
  models: "车型",
  categories: "车辆分类",
  tags: "标签"
};
const permissionMap: Record<Kind, string> = {
  brands: "brand:manage",
  series: "series:manage",
  models: "model:manage",
  categories: "category:manage",
  tags: "tag:manage"
};
const canManage = computed(() => hasPerms(permissionMap[active.value]));

async function load(): Promise<void> {
  loading.value = true;
  try {
    const params = { keyword: keyword.value || undefined };
    const loaders = {
      brands: getBrands,
      series: getSeries,
      models: getModels,
      categories: getCategories,
      tags: getTags
    };
    rows.value = (await loaders[active.value](params)) as CatalogItem[];
    if (!brands.value.length || active.value !== "brands")
      brands.value = (await getBrands()) as Brand[];
  } finally {
    loading.value = false;
  }
}

async function updateSeriesOptions(reset = true): Promise<void> {
  if (reset) form.seriesId = "";
  seriesOptions.value = form.brandId
    ? ((await getSeries({ brandId: form.brandId })) as VehicleSeries[])
    : [];
}

function resetForm(): void {
  Object.assign(form, {
    nameZh: "",
    brandId: "",
    seriesId: "",
    logoMediaId: null,
    country: "",
    descriptionZh: "",
    year: undefined,
    sortOrder: 0,
    color: "#C72C35",
    isEnabled: true,
    seoTitle: "",
    seoKeywords: "",
    seoDescription: ""
  });
}

function openCreate(): void {
  editingId.value = "";
  resetForm();
  dialogOpen.value = true;
}

async function openEdit(row: CatalogItem): Promise<void> {
  editingId.value = row.id;
  resetForm();
  for (const key of Object.keys(form) as Array<keyof typeof form>) {
    const value = row[key];
    if (value !== undefined && value !== null && typeof value !== "object")
      (form[key] as unknown) = value;
  }
  if (active.value === "brands")
    form.logoMediaId = String(row.logoMediaId || "") || null;
  if (active.value === "models") await updateSeriesOptions(false);
  dialogOpen.value = true;
}

function payload(): Record<string, unknown> {
  const common = {
    nameZh: form.nameZh.trim(),
    isEnabled: form.isEnabled
  };
  if (active.value === "tags")
    return { ...common, color: form.color || undefined };
  const detail = {
    ...common,
    descriptionZh: form.descriptionZh || undefined,
    sortOrder: form.sortOrder
  };
  if (active.value === "brands")
    return {
      ...detail,
      logoMediaId: form.logoMediaId || undefined,
      country: form.country || undefined,
      seoTitle: form.seoTitle || undefined,
      seoKeywords: form.seoKeywords || undefined,
      seoDescription: form.seoDescription || undefined
    };
  if (active.value === "categories") return detail;
  if (active.value === "series") return { ...detail, brandId: form.brandId };
  return {
    ...detail,
    brandId: form.brandId,
    seriesId: form.seriesId,
    year: form.year
  };
}

async function save(): Promise<void> {
  if (!form.nameZh.trim()) {
    ElMessage.warning("请填写中文名称");
    return;
  }
  if (
    (active.value === "series" || active.value === "models") &&
    !form.brandId
  ) {
    ElMessage.warning("请选择品牌");
    return;
  }
  if (active.value === "models" && !form.seriesId) {
    ElMessage.warning("请选择车系");
    return;
  }
  saving.value = true;
  try {
    if (editingId.value)
      await updateCatalog(active.value, editingId.value, payload());
    else await createCatalog(active.value, payload());
    ElMessage.success(`${titleMap[active.value]}已保存`);
    dialogOpen.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: CatalogItem): Promise<void> {
  await ElMessageBox.confirm(
    `确认删除${titleMap[active.value]}“${row.nameZh}”？`,
    "删除确认",
    { type: "warning" }
  );
  await deleteCatalog(active.value, row.id);
  ElMessage.success("已删除");
  await load();
}

watch(active, () => {
  keyword.value = "";
  void load();
});
watch(
  () => route.meta.catalogKind,
  value => {
    if (value) active.value = value;
  }
);
onMounted(load);
</script>

<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>车辆目录</h1>
        <p>维护品牌、车系、车型、分类及业务标签</p>
      </div>
      <el-button v-if="canManage" type="primary" @click="openCreate"
        ><IconifyIconOnline icon="ri:add-line" />新增{{
          titleMap[active]
        }}</el-button
      >
    </div>
    <el-tabs v-model="active">
      <el-tab-pane label="品牌" name="brands" /><el-tab-pane
        label="车系"
        name="series"
      /><el-tab-pane label="车型" name="models" /><el-tab-pane
        label="车辆分类"
        name="categories"
      /><el-tab-pane label="车辆标签" name="tags" />
    </el-tabs>
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        clearable
        :placeholder="`搜索${titleMap[active]}名称`"
        style="width: 260px"
        @keyup.enter="load"
      /><el-button type="primary" @click="load">查询</el-button>
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column v-if="active === 'brands'" label="标识" width="76"
          ><template #default="{ row }"
            ><el-image
              v-if="row.logoMedia?.url"
              :src="resolveMediaUrl(row.logoMedia.url as string)"
              fit="contain"
              style="width: 44px; height: 32px" /><IconifyIconOnline
              v-else
              icon="ri:car-line"
              style="font-size: 24px; color: var(--ops-muted)" /></template
        ></el-table-column>
        <el-table-column
          prop="nameZh"
          label="中文名称"
          min-width="130"
        /><el-table-column prop="nameEn" label="英文名称" min-width="150" />
        <el-table-column
          v-if="active === 'series' || active === 'models'"
          label="品牌"
          min-width="120"
          ><template #default="{ row }">{{
            row.brand?.nameZh
          }}</template></el-table-column
        >
        <el-table-column v-if="active === 'models'" label="车系" min-width="120"
          ><template #default="{ row }">{{
            row.series?.nameZh
          }}</template></el-table-column
        >
        <el-table-column
          v-if="active === 'models'"
          prop="year"
          label="年份"
          width="80"
        />
        <el-table-column v-if="active === 'tags'" label="颜色" width="90"
          ><template #default="{ row }"
            ><span
              class="color-dot"
              :style="{ backgroundColor: row.color || '#909399' }" /></template
        ></el-table-column>
        <el-table-column label="关联数量" width="100" align="center"
          ><template #default="{ row }">{{
            Object.values(row._count || {}).reduce(
              (sum: number, count) => sum + Number(count),
              0
            )
          }}</template></el-table-column
        >
        <el-table-column label="状态" width="90"
          ><template #default="{ row }"
            ><el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{
              row.isEnabled ? "启用" : "停用"
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column v-if="canManage" label="操作" width="130" fixed="right"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              @click="openEdit(row as CatalogItem)"
              >编辑</el-button
            ><el-button link type="danger" @click="remove(row as CatalogItem)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </div>

    <el-dialog
      v-model="dialogOpen"
      :title="`${editingId ? '编辑' : '新增'}${titleMap[active]}`"
      width="min(680px, 94vw)"
      destroy-on-close
    >
      <el-form :model="form" label-position="top"
        ><div class="dialog-grid">
          <el-form-item label="中文名称" required
            ><el-input v-model="form.nameZh" maxlength="120"
          /></el-form-item>
          <el-form-item
            v-if="active === 'series' || active === 'models'"
            label="所属品牌"
            required
            ><el-select
              v-model="form.brandId"
              filterable
              @change="updateSeriesOptions(true)"
              ><el-option
                v-for="item in brands"
                :key="item.id"
                :label="item.nameZh"
                :value="item.id" /></el-select
          ></el-form-item>
          <el-form-item v-if="active === 'models'" label="所属车系" required
            ><el-select v-model="form.seriesId" filterable
              ><el-option
                v-for="item in seriesOptions"
                :key="item.id"
                :label="item.nameZh"
                :value="item.id" /></el-select
          ></el-form-item>
          <el-form-item v-if="active === 'models'" label="年份"
            ><el-input-number v-model="form.year" :min="1900" :max="2200"
          /></el-form-item>
          <el-form-item v-if="active === 'brands'" label="国家或地区"
            ><el-input v-model="form.country"
          /></el-form-item>
          <el-form-item v-if="active === 'brands'" label="品牌 Logo"
            ><MediaPicker v-model="form.logoMediaId"
          /></el-form-item>
          <el-form-item v-if="active === 'tags'" label="标签颜色"
            ><el-color-picker v-model="form.color"
          /></el-form-item>
          <el-form-item v-if="active !== 'tags'" label="排序"
            ><el-input-number v-model="form.sortOrder" :min="0"
          /></el-form-item>
          <el-form-item label="是否启用"
            ><el-switch v-model="form.isEnabled"
          /></el-form-item>
          <el-form-item v-if="active !== 'tags'" label="中文说明" class="span-2"
            ><el-input v-model="form.descriptionZh" type="textarea" :rows="3"
          /></el-form-item>
          <template v-if="active === 'brands'"
            ><el-form-item label="SEO 标题" class="span-2"
              ><el-input v-model="form.seoTitle" /></el-form-item
            ><el-form-item label="SEO 关键词" class="span-2"
              ><el-input v-model="form.seoKeywords" /></el-form-item
            ><el-form-item label="SEO 描述" class="span-2"
              ><el-input
                v-model="form.seoDescription"
                type="textarea" /></el-form-item
          ></template></div
      ></el-form>
      <template #footer
        ><el-button @click="dialogOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
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

.color-dot {
  display: inline-block;
  width: 22px;
  height: 22px;
  border: 1px solid #d8dce1;
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
