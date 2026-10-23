<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import MediaPicker from "@/components/MediaPicker/index.vue";
import { createPage, getPage, publishPage, updatePage } from "@/api/content";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { pageFormValidationMessage } from "@/validation/business";

defineOptions({ name: "PageForm" });
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const isDirty = ref(false);
const trackChanges = ref(false);
const id = computed(() => String(route.params.id || ""));
const form = reactive({
  titleZh: "",
  summaryZh: "",
  contentZh: "",
  ogMediaId: null as string | null,
  seoTitle: "",
  seoKeywords: "",
  seoDescription: ""
});

useUnsavedChanges(isDirty);
watch(
  form,
  () => {
    if (trackChanges.value) isDirty.value = true;
  },
  { deep: true }
);
function payload() {
  return Object.fromEntries(
    Object.entries(form).filter(([, v]) => v !== "" && v !== null)
  );
}
async function save(publish = false) {
  const validationMessage = pageFormValidationMessage(form);
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }
  saving.value = true;
  try {
    const page = id.value
      ? await updatePage(id.value, payload())
      : await createPage(payload());
    if (publish) await publishPage(page.id);
    ElMessage.success(publish ? "页面已发布" : "页面已保存");
    isDirty.value = false;
    await router.push("/content/pages");
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  if (id.value) {
    loading.value = true;
    try {
      const page = await getPage(id.value);
      Object.keys(form).forEach(key => {
        if (page[key] !== undefined && page[key] !== null)
          (form as Record<string, unknown>)[key] = page[key];
      });
      const content = page.content as Record<string, string> | undefined;
      form.contentZh = content?.zh || "";
    } finally {
      loading.value = false;
    }
  }
  await nextTick();
  trackChanges.value = true;
});
</script>
<template>
  <div v-loading="loading" class="admin-page page-editor">
    <div class="page-heading">
      <div>
        <h1>{{ id ? "编辑页面" : "新增页面" }}</h1>
        <p>正文 HTML 会在服务端进行安全清洗</p>
      </div>
      <el-button @click="router.push('/content/pages')"
        ><IconifyIconOnline icon="ri:arrow-left-line" />返回列表</el-button
      >
    </div>
    <el-form label-position="top"
      ><section class="form-section">
        <h2>页面信息</h2>
        <div class="form-grid">
          <el-form-item label="中文标题" required
            ><el-input v-model="form.titleZh" /></el-form-item
          ><el-form-item label="分享图片"
            ><MediaPicker v-model="form.ogMediaId"
          /></el-form-item>
        </div>
      </section>
      <section class="form-section">
        <h2>中文内容</h2>
        <el-form-item label="摘要"
          ><el-input v-model="form.summaryZh" type="textarea" :rows="3"
        /></el-form-item>
        <el-form-item label="正文 HTML" required
          ><el-input
            v-model="form.contentZh"
            type="textarea"
            :rows="18"
            class="code-input"
        /></el-form-item>
      </section>
      <section class="form-section">
        <h2>SEO</h2>
        <div class="form-grid">
          <el-form-item label="SEO 标题"
            ><el-input v-model="form.seoTitle" /></el-form-item
          ><el-form-item label="SEO 关键词"
            ><el-input v-model="form.seoKeywords" /></el-form-item
          ><el-form-item label="SEO 描述" class="span-2"
            ><el-input v-model="form.seoDescription" type="textarea" :rows="3"
          /></el-form-item>
        </div></section
    ></el-form>
    <div class="sticky-actions">
      <span>保存后可继续编辑，发布后官网立即可见</span>
      <div>
        <el-button :loading="saving" @click="save(false)"
          ><IconifyIconOnline icon="ri:save-line" />保存草稿</el-button
        ><el-button type="primary" :loading="saving" @click="save(true)"
          ><IconifyIconOnline icon="ri:send-plane-line" />保存并发布</el-button
        >
      </div>
    </div>
  </div>
</template>
<style scoped>
.page-editor {
  padding-bottom: 74px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
  max-width: 980px;
}

.span-2 {
  grid-column: span 2;
}

.code-input :deep(textarea) {
  font-family: Consolas, monospace;
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
  background: rgb(255 255 255/96%);
  border-top: 1px solid var(--ops-line);
}

@media (width <= 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }

  .sticky-actions {
    left: 0;
  }

  .sticky-actions span {
    display: none;
  }
}
</style>
