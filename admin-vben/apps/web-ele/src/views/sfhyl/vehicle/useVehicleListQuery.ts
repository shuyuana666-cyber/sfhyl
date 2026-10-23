import { computed, onMounted, reactive, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import { getBrands, getCategories, getModels, getSeries } from "@/api/catalog";
import { getVehicles } from "@/api/vehicles";
import type {
  Brand,
  Vehicle,
  VehicleCategory,
  VehicleModel,
  VehicleSeries
} from "@/types/business";
import { getRequestErrorMessage } from "@/utils/http/error-message";

function defaultQuery() {
  return {
    page: 1,
    pageSize: 20,
    keyword: "",
    brandId: "",
    seriesId: "",
    modelId: "",
    categoryId: "",
    type: "",
    status: "",
    saleStatus: "",
    isFeatured: "",
    deleted: "false",
    yearMin: undefined as number | undefined,
    yearMax: undefined as number | undefined,
    priceMin: "",
    priceMax: "",
    createdFrom: "",
    createdTo: "",
    publishedFrom: "",
    publishedTo: "",
    sortBy: "createdAt",
    sortOrder: "desc"
  };
}

export function useVehicleListQuery(route: RouteLocationNormalizedLoaded) {
  const loading = ref(false);
  const initializing = ref(true);
  const loadError = ref("");
  const rows = ref<Vehicle[]>([]);
  const brands = ref<Brand[]>([]);
  const series = ref<VehicleSeries[]>([]);
  const models = ref<VehicleModel[]>([]);
  const categories = ref<VehicleCategory[]>([]);
  const total = ref(0);
  const advancedOpen = ref(false);
  const query = reactive(defaultQuery());
  const queryStorageKey = computed(
    () => `sfhyl.vehicle-list.${String(route.name || "list")}`
  );
  const pageTitle = computed(() => route.meta.title || "车辆管理");

  async function load(): Promise<void> {
    loading.value = true;
    loadError.value = "";
    try {
      const result = await getVehicles(
        Object.fromEntries(
          Object.entries(query).filter(
            ([, value]) => value !== "" && value !== undefined
          )
        )
      );
      rows.value = result.items;
      total.value = result.pagination.total;
    } catch (error) {
      rows.value = [];
      total.value = 0;
      loadError.value = getRequestErrorMessage(error);
    } finally {
      loading.value = false;
      initializing.value = false;
    }
  }

  async function loadInitialFilterOptions(): Promise<void> {
    const [brandResult, categoryResult] = await Promise.allSettled([
      getBrands(),
      getCategories()
    ]);
    brands.value = brandResult.status === "fulfilled" ? brandResult.value : [];
    categories.value =
      categoryResult.status === "fulfilled" ? categoryResult.value : [];
  }

  function applyRoutePreset(): void {
    series.value = [];
    models.value = [];
    Object.assign(query, defaultQuery());
    Object.assign(query, route.meta.vehiclePreset || {});
    try {
      const stored = sessionStorage.getItem(queryStorageKey.value);
      if (stored) Object.assign(query, JSON.parse(stored));
    } catch {
      sessionStorage.removeItem(queryStorageKey.value);
    }
    advancedOpen.value = Boolean(
      query.brandId ||
      query.seriesId ||
      query.modelId ||
      query.categoryId ||
      query.isFeatured ||
      query.deleted === "true" ||
      query.yearMin ||
      query.yearMax ||
      query.priceMin ||
      query.priceMax ||
      query.createdFrom ||
      query.createdTo ||
      query.publishedFrom ||
      query.publishedTo
    );
  }

  function reset(): void {
    series.value = [];
    models.value = [];
    Object.assign(query, defaultQuery());
    Object.assign(query, route.meta.vehiclePreset || {});
    advancedOpen.value = false;
    void load();
  }

  async function loadSeriesOptions(): Promise<void> {
    query.seriesId = "";
    query.modelId = "";
    series.value = query.brandId
      ? await getSeries({ brandId: query.brandId })
      : [];
    models.value = [];
  }

  async function loadModelOptions(): Promise<void> {
    query.modelId = "";
    models.value = query.seriesId
      ? await getModels({ brandId: query.brandId, seriesId: query.seriesId })
      : [];
  }

  watch(
    () => route.name,
    () => {
      applyRoutePreset();
      void load();
    }
  );
  watch(
    query,
    value => {
      sessionStorage.setItem(queryStorageKey.value, JSON.stringify(value));
    },
    { deep: true }
  );
  onMounted(() => {
    applyRoutePreset();
    void load();
    void loadInitialFilterOptions();
  });

  return {
    advancedOpen,
    applyRoutePreset,
    brands,
    categories,
    initializing,
    load,
    loadError,
    loadModelOptions,
    loadSeriesOptions,
    loading,
    models,
    pageTitle,
    query,
    reset,
    rows,
    series,
    total
  };
}
