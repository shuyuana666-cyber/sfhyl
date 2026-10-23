<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";
import MediaPicker from "@/components/MediaPicker/index.vue";
import {
  createBanner,
  deleteBanner,
  getBanners,
  sortBanners,
  updateBanner,
  type HomepageRecord
} from "@/api/homepage";
import { hasPerms } from "@/utils/auth";
import { resolveMediaUrl } from "@/utils/media";

defineOptions({ name: "Banners" });
const loading = ref(false);
const saving = ref(false);
const open = ref(false);
const rows = ref<HomepageRecord[]>([]);
const editingId = ref("");
const form = reactive({
  key: "",
  titleZh: "",
  titleEn: "",
  subtitleZh: "",
  subtitleEn: "",
  descriptionZh: "",
  descriptionEn: "",
  desktopMediaId: null as string | null,
  mobileMediaId: null as string | null,
  buttonTextZh: "",
  buttonTextEn: "",
  linkUrl: "",
  linkTarget: "SAME_TAB",
  status: "DRAFT",
  startsAt: "",
  endsAt: "",
  sortOrder: 0
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await getBanners();
  } finally {
    loading.value = false;
  }
}
function reset(): void {
  Object.assign(form, {
    key: "",
    titleZh: "",
    titleEn: "",
    subtitleZh: "",
    subtitleEn: "",
    descriptionZh: "",
    descriptionEn: "",
    desktopMediaId: null,
    mobileMediaId: null,
    buttonTextZh: "",
    buttonTextEn: "",
    linkUrl: "",
    linkTarget: "SAME_TAB",
    status: "DRAFT",
    startsAt: "",
    endsAt: "",
    sortOrder: rows.value.length
  });
}
function create(): void {
  editingId.value = "";
  reset();
  open.value = true;
}
function edit(row: HomepageRecord): void {
  editingId.value = row.id;
  reset();
  Object.keys(form).forEach(key => {
    const value = row[key];
    if (value !== undefined && value !== null)
      (form as Record<string, unknown>)[key] = key.endsWith("At")
        ? dayjs(String(value)).format("YYYY-MM-DDTHH:mm:ss")
        : value;
  });
  open.value = true;
}
function payload(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(form).filter(([, value]) => value !== "" && value !== null)
  );
}
async function save(): Promise<void> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.key)) {
    ElMessage.warning("请输入有效的唯一标识");
    return;
  }
  if (!form.desktopMediaId) {
    ElMessage.warning("请选择 PC 端图片");
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) await updateBanner(editingId.value, payload());
    else await createBanner(payload());
    ElMessage.success("轮播图已保存");
    open.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: HomepageRecord): Promise<void> {
  await ElMessageBox.confirm(
    `确认删除轮播图“${row.titleZh || row.key}”？`,
    "删除确认",
    { type: "warning" }
  );
  await deleteBanner(row.id);
  ElMessage.success("已删除");
  await load();
}
async function move(index: number, direction: -1 | 1): Promise<void> {
  const target = index + direction;
  if (target < 0 || target >= rows.value.length) return;
  const next = [...rows.value];
  [next[index], next[target]] = [next[target], next[index]];
  await sortBanners(
    next.map((item, sortOrder) => ({ id: item.id, sortOrder }))
  );
  await load();
}
onMounted(load);
</script>

<template>
  <div class="admin-page">
    <div class="page-heading">
      <div>
        <h1>首页轮播图</h1>
        <p>控制 PC 与移动端首屏内容及生效时间</p>
      </div>
      <el-button v-if="hasPerms('banner:create')" type="primary" @click="create"
        ><IconifyIconOnline icon="ri:add-line" />新增轮播图</el-button
      >
    </div>
    <div class="table-wrap">
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column label="预览" width="140"
          ><template #default="{ row }"
            ><el-image
              v-if="row.desktopMedia?.url"
              :src="resolveMediaUrl(row.desktopMedia.url)"
              fit="cover"
              style="width: 108px; height: 58px; border-radius: 4px"
              ><template #error
                ><div class="image-placeholder">
                  <IconifyIconOnline icon="ri:image-line" /></div></template
            ></el-image>
            <div v-else class="image-placeholder">
              <IconifyIconOnline icon="ri:image-line" /></div></template
        ></el-table-column>
        <el-table-column label="内容" min-width="220"
          ><template #default="{ row }"
            ><strong>{{ row.titleZh || row.key }}</strong>
            <div class="subline">{{ row.subtitleZh }}</div></template
          ></el-table-column
        >
        <el-table-column prop="key" label="标识" width="130" /><el-table-column
          label="有效期"
          width="210"
          ><template #default="{ row }"
            >{{
              row.startsAt ? dayjs(row.startsAt).format("YYYY-MM-DD") : "立即"
            }}
            至
            {{
              row.endsAt ? dayjs(row.endsAt).format("YYYY-MM-DD") : "长期"
            }}</template
          ></el-table-column
        >
        <el-table-column label="状态" width="90"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.status === 'ACTIVE'
                  ? 'success'
                  : row.status === 'DRAFT'
                    ? 'info'
                    : 'warning'
              "
              size="small"
              >{{
                { ACTIVE: "启用", DRAFT: "草稿", INACTIVE: "停用" }[row.status]
              }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column v-if="hasPerms('banner:sort')" label="排序" width="110"
          ><template #default="{ $index }"
            ><el-button
              circle
              text
              :disabled="$index === 0"
              @click="move($index, -1)"
              ><IconifyIconOnline icon="ri:arrow-up-line" /></el-button
            ><el-button
              circle
              text
              :disabled="$index === rows.length - 1"
              @click="move($index, 1)"
              ><IconifyIconOnline
                icon="ri:arrow-down-line" /></el-button></template
        ></el-table-column>
        <el-table-column label="操作" width="130" fixed="right"
          ><template #default="{ row }"
            ><el-button
              v-if="hasPerms('banner:update')"
              link
              type="primary"
              @click="edit(row as HomepageRecord)"
              >编辑</el-button
            ><el-button
              v-if="hasPerms('banner:delete')"
              link
              type="danger"
              @click="remove(row as HomepageRecord)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </div>
    <el-dialog
      v-model="open"
      :title="editingId ? '编辑轮播图' : '新增轮播图'"
      width="min(780px,94vw)"
      destroy-on-close
      ><el-form label-position="top"
        ><div class="dialog-grid">
          <el-form-item label="唯一标识" required
            ><el-input
              v-model="form.key"
              :disabled="Boolean(editingId)"
              placeholder="summer-sale" /></el-form-item
          ><el-form-item label="状态"
            ><el-select v-model="form.status"
              ><el-option label="草稿" value="DRAFT" /><el-option
                label="启用"
                value="ACTIVE" /><el-option
                label="停用"
                value="INACTIVE" /></el-select
          ></el-form-item>
          <el-form-item label="中文标题"
            ><el-input v-model="form.titleZh" /></el-form-item
          ><el-form-item label="英文标题"
            ><el-input v-model="form.titleEn" /></el-form-item
          ><el-form-item label="中文副标题"
            ><el-input v-model="form.subtitleZh" /></el-form-item
          ><el-form-item label="英文副标题"
            ><el-input v-model="form.subtitleEn"
          /></el-form-item>
          <el-form-item label="PC 端图片" required
            ><MediaPicker v-model="form.desktopMediaId" /></el-form-item
          ><el-form-item label="移动端图片"
            ><MediaPicker v-model="form.mobileMediaId"
          /></el-form-item>
          <el-form-item label="中文按钮"
            ><el-input v-model="form.buttonTextZh" /></el-form-item
          ><el-form-item label="英文按钮"
            ><el-input v-model="form.buttonTextEn" /></el-form-item
          ><el-form-item label="跳转链接"
            ><el-input
              v-model="form.linkUrl"
              placeholder="https://..." /></el-form-item
          ><el-form-item label="打开方式"
            ><el-select v-model="form.linkTarget"
              ><el-option label="当前窗口" value="SAME_TAB" /><el-option
                label="新窗口"
                value="NEW_TAB" /></el-select
          ></el-form-item>
          <el-form-item label="开始时间"
            ><el-date-picker
              v-model="form.startsAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item
          ><el-form-item label="结束时间"
            ><el-date-picker
              v-model="form.endsAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
          /></el-form-item>
          <el-form-item label="中文说明" class="span-2"
            ><el-input
              v-model="form.descriptionZh"
              type="textarea"
              :rows="3" /></el-form-item
          ><el-form-item label="英文说明" class="span-2"
            ><el-input v-model="form.descriptionEn" type="textarea" :rows="3"
          /></el-form-item></div></el-form
      ><template #footer
        ><el-button @click="open = false">取消</el-button
        ><el-button
          v-if="
            editingId ? hasPerms('banner:update') : hasPerms('banner:create')
          "
          type="primary"
          :loading="saving"
          @click="save"
          >保存</el-button
        ></template
      ></el-dialog
    >
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

.image-placeholder {
  display: grid;
  place-items: center;
  width: 108px;
  height: 58px;
  font-size: 24px;
  color: var(--ops-muted);
  background: #eef0f2;
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
