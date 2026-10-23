<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

import { getSettings, updateSettings } from "@/api/settings";
import PageLoadState from "@/components/PageLoadState/index.vue";
import { usePageLoad } from "@/composables/usePageLoad";
import { showActionError } from "@/utils/action-feedback";
import { hasPerms } from "@/utils/auth";
import { ElMessage } from "element-plus";

defineOptions({ name: "TranslationModelSettings" });

type Protocol = "anthropic" | "openai";

interface TranslationModelResponse {
  protocol?: Protocol;
  baseUrl?: string;
  model?: string;
  apiKeyConfigured?: boolean;
}

const { loading, loadError, runLoad } = usePageLoad();
const saving = ref(false);
const apiKeyConfigured = ref(false);
const form = reactive({
  protocol: "openai" as Protocol,
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini"
});
const apiKeyPlaceholder = computed(() =>
  apiKeyConfigured.value ? "已配置，留空则保持当前密钥" : "请输入 API Key"
);

async function load(): Promise<void> {
  await runLoad(async () => {
    const data = await getSettings();
    const settings = (data.translation_model || {}) as TranslationModelResponse;
    form.protocol = settings.protocol || "openai";
    form.baseUrl = settings.baseUrl || "https://api.openai.com/v1";
    form.model = settings.model || "gpt-4o-mini";
    form.apiKey = "";
    apiKeyConfigured.value = Boolean(settings.apiKeyConfigured);
  });
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const result = await updateSettings("translation_model", { ...form });
    apiKeyConfigured.value = Boolean(result.apiKeyConfigured);
    form.apiKey = "";
    ElMessage.success("API 模型配置已保存");
  } catch (error) {
    showActionError(error);
  } finally {
    saving.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <div v-loading="loading" class="admin-page translation-model-page">
    <div class="page-heading">
      <div>
        <h1>API 模型配置</h1>
      </div>
      <el-button
        v-if="hasPerms('settings:update')"
        type="primary"
        :loading="saving"
        :disabled="loading || !!loadError"
        @click="save"
      >
        <IconifyIconOnline icon="ri:save-line" />保存
      </el-button>
    </div>

    <PageLoadState :loading="loading" :error="loadError" :ready="true" @retry="load" />
    <el-form v-if="!loadError" :disabled="loading" label-position="top" class="translation-model-form">
      <el-form-item label="协议">
        <el-radio-group v-model="form.protocol">
          <el-radio-button label="openai">OpenAI Compatible</el-radio-button>
          <el-radio-button label="anthropic">
Anthropic Compatible
</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="Base URL">
        <el-input
          v-model="form.baseUrl"
          placeholder="https://api.openai.com/v1"
          autocomplete="url"
        />
      </el-form-item>
      <el-form-item label="API Key">
        <el-input
          v-model="form.apiKey"
          type="password"
          :placeholder="apiKeyPlaceholder"
          autocomplete="new-password"
          show-password
        />
        <el-text
          v-if="apiKeyConfigured"
          type="success"
          size="small"
          class="configured-state"
        >
          已配置
        </el-text>
      </el-form-item>
      <el-form-item label="模型 ID">
        <el-input v-model="form.model" placeholder="gpt-4o-mini" />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.translation-model-page {
  max-width: 880px;
}

.page-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-heading h1 {
  margin: 0;
  font-size: var(--sf-font-title);
}

.translation-model-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
}

.translation-model-form :deep(.el-form-item:first-child),
.translation-model-form :deep(.el-form-item:nth-child(2)) {
  grid-column: span 2;
}

.configured-state {
  margin-top: 8px;
}

@media (width <= 760px) {
  .translation-model-form {
    grid-template-columns: 1fr;
  }

  .translation-model-form :deep(.el-form-item:first-child),
  .translation-model-form :deep(.el-form-item:nth-child(2)) {
    grid-column: auto;
  }
}
</style>
