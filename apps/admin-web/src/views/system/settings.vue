<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import MediaPicker from "@/components/MediaPicker/index.vue";
import { getSettings, updateSettings } from "@/api/settings";
import type { MediaAsset } from "@/types/business";
import { hasPerms } from "@/utils/auth";

defineOptions({ name: "Settings" });
const route = useRoute();
const loading = ref(false);
const saving = ref(false);
const active = ref(route.meta.settingsGroup || "basic");
const pageTitle = computed(() => route.meta.title || "网站设置");
const mediaSelection = reactive<Record<string, string | null>>({
  logoUrl: null,
  darkLogoUrl: null,
  mobileLogoUrl: null,
  faviconUrl: null,
  shareImageUrl: null
});
const form = reactive({
  basic: {
    siteNameZh: "",
    siteNameEn: "",
    siteNameRu: "",
    shortName: "",
    defaultLanguage: "zh-CN",
    defaultCurrency: "USD",
    timezone: "Asia/Shanghai",
    siteDescription: "",
    companyNameZh: "",
    companyNameEn: ""
  },
  branding: {
    logoUrl: "",
    darkLogoUrl: "",
    mobileLogoUrl: "",
    faviconUrl: "",
    shareImageUrl: ""
  },
  contact: {
    phone: "",
    whatsapp: "",
    wechat: "",
    email: "",
    address: "",
    businessHours: ""
  },
  social: {
    facebook: "",
    instagram: "",
    youtube: "",
    linkedin: "",
    tiktok: "",
    x: "",
    vk: ""
  },
  seo: { defaultTitle: "", defaultKeywords: "", defaultDescription: "" },
  footer: { copyright: "", icpNumber: "", publicSecurityNumber: "" },
  features: { maintenanceMode: false, maintenanceMessage: "" }
});
type Group = keyof typeof form;
const labels: Record<Group, string> = {
  basic: "基础信息",
  branding: "品牌标识",
  contact: "联系方式",
  social: "社交媒体",
  seo: "SEO 默认值",
  footer: "页脚信息",
  features: "功能开关"
};
async function save(group: Group) {
  saving.value = true;
  try {
    await updateSettings(group, form[group]);
    ElMessage.success(`${labels[group]}已保存`);
  } finally {
    saving.value = false;
  }
}
function chooseAsset(key: keyof typeof form.branding, assets: MediaAsset[]) {
  const asset = assets[0];
  if (asset) form.branding[key] = asset.webpUrl || asset.url;
}
watch(
  () => route.meta.settingsGroup,
  group => {
    if (group) active.value = group;
  }
);
onMounted(async () => {
  loading.value = true;
  try {
    const data = await getSettings();
    (Object.keys(form) as Group[]).forEach(group =>
      Object.assign(form[group], data[group] || {})
    );
  } finally {
    loading.value = false;
  }
});
</script>
<template>
  <div v-loading="loading" class="admin-page settings-page">
    <div class="page-heading">
      <div>
        <h1>{{ pageTitle }}</h1>
        <p>保存后通过公开 API 同步到 sfhyl.cn</p>
      </div>
    </div>
    <el-tabs v-model="active" tab-position="left" class="settings-tabs"
      ><el-tab-pane
        v-for="(label, group) in labels"
        :key="group"
        :label="label"
        :name="group"
        ><section class="settings-section">
          <div class="settings-title">
            <div>
              <h2>{{ label }}</h2>
              <p>配置将写入数据库并立即用于官网公开接口</p>
            </div>
            <el-button
              v-if="hasPerms('settings:update')"
              type="primary"
              :loading="saving"
              @click="save(group as Group)"
              ><IconifyIconOnline icon="ri:save-line" />保存</el-button
            >
          </div>
          <el-form
            v-if="group === 'basic'"
            label-position="top"
            class="settings-grid"
            ><el-form-item label="网站中文名称"
              ><el-input v-model="form.basic.siteNameZh" /></el-form-item
            ><el-form-item label="网站英文名称"
              ><el-input v-model="form.basic.siteNameEn" /></el-form-item
            ><el-form-item label="网站俄文名称"
              ><el-input v-model="form.basic.siteNameRu" /></el-form-item
            ><el-form-item label="网站简称"
              ><el-input v-model="form.basic.shortName" /></el-form-item
            ><el-form-item label="公司中文名称"
              ><el-input v-model="form.basic.companyNameZh" /></el-form-item
            ><el-form-item label="公司英文名称"
              ><el-input v-model="form.basic.companyNameEn" /></el-form-item
            ><el-form-item label="默认语言"
              ><el-select v-model="form.basic.defaultLanguage"
                ><el-option label="简体中文" value="zh-CN" /><el-option
                  label="English"
                  value="en" /><el-option
                  label="Русский"
                  value="ru" /></el-select></el-form-item
            ><el-form-item label="默认货币"
              ><el-select v-model="form.basic.defaultCurrency"
                ><el-option
                  v-for="item in ['CNY', 'USD', 'RUB', 'EUR']"
                  :key="item"
                  :value="item" /></el-select></el-form-item
            ><el-form-item label="默认时区"
              ><el-input v-model="form.basic.timezone" /></el-form-item
            ><el-form-item label="网站描述" class="span-2"
              ><el-input
                v-model="form.basic.siteDescription"
                type="textarea"
                :rows="4" /></el-form-item
          ></el-form>
          <el-form
            v-else-if="group === 'branding'"
            label-position="top"
            class="branding-list"
            ><el-form-item
              v-for="(name, key) in {
                logoUrl: '网站 Logo',
                darkLogoUrl: '深色 Logo',
                mobileLogoUrl: '移动端 Logo',
                faviconUrl: '浏览器 Favicon',
                shareImageUrl: '默认分享图片'
              }"
              :key="key"
              :label="name"
              ><div class="asset-setting">
                <img
                  v-if="form.branding[key]"
                  :src="form.branding[key]"
                  alt=""
                />
                <div>
                  <el-input
                    v-model="form.branding[key]"
                    placeholder="素材 URL"
                  /><MediaPicker
                    v-if="hasPerms('settings:update')"
                    v-model="mediaSelection[key]"
                    @select="assets => chooseAsset(key, assets)"
                  />
                </div></div></el-form-item
          ></el-form>
          <el-form
            v-else-if="group === 'contact'"
            label-position="top"
            class="settings-grid"
            ><el-form-item label="联系电话"
              ><el-input v-model="form.contact.phone" /></el-form-item
            ><el-form-item label="WhatsApp"
              ><el-input v-model="form.contact.whatsapp" /></el-form-item
            ><el-form-item label="微信"
              ><el-input v-model="form.contact.wechat" /></el-form-item
            ><el-form-item label="邮箱"
              ><el-input v-model="form.contact.email" /></el-form-item
            ><el-form-item label="营业时间"
              ><el-input v-model="form.contact.businessHours" /></el-form-item
            ><el-form-item label="公司地址" class="span-2"
              ><el-input
                v-model="form.contact.address"
                type="textarea" /></el-form-item
          ></el-form>
          <el-form
            v-else-if="group === 'social'"
            label-position="top"
            class="settings-grid"
            ><el-form-item label="Facebook"
              ><el-input v-model="form.social.facebook" /></el-form-item
            ><el-form-item label="Instagram"
              ><el-input v-model="form.social.instagram" /></el-form-item
            ><el-form-item label="YouTube"
              ><el-input v-model="form.social.youtube" /></el-form-item
            ><el-form-item label="LinkedIn"
              ><el-input v-model="form.social.linkedin" /></el-form-item
            ><el-form-item label="TikTok"
              ><el-input v-model="form.social.tiktok" /></el-form-item
            ><el-form-item label="X / Twitter"
              ><el-input v-model="form.social.x" /></el-form-item
            ><el-form-item label="VK"
              ><el-input v-model="form.social.vk" /></el-form-item
          ></el-form>
          <el-form v-else-if="group === 'seo'" label-position="top"
            ><el-form-item label="默认标题"
              ><el-input v-model="form.seo.defaultTitle" /></el-form-item
            ><el-form-item label="默认关键词"
              ><el-input v-model="form.seo.defaultKeywords" /></el-form-item
            ><el-form-item label="默认描述"
              ><el-input
                v-model="form.seo.defaultDescription"
                type="textarea"
                :rows="5" /></el-form-item
          ></el-form>
          <el-form v-else-if="group === 'footer'" label-position="top"
            ><el-form-item label="版权文字"
              ><el-input v-model="form.footer.copyright" /></el-form-item
            ><el-form-item label="ICP备案号"
              ><el-input v-model="form.footer.icpNumber" /></el-form-item
            ><el-form-item label="公安备案号"
              ><el-input
                v-model="form.footer.publicSecurityNumber" /></el-form-item
          ></el-form>
          <el-form v-else label-position="top"
            ><el-form-item label="维护模式"
              ><el-switch
                v-model="form.features.maintenanceMode"
                active-text="开启"
                inactive-text="关闭" /></el-form-item
            ><el-form-item label="维护提示"
              ><el-input
                v-model="form.features.maintenanceMessage"
                type="textarea"
                :rows="4" /></el-form-item
          ></el-form></section></el-tab-pane
    ></el-tabs>
  </div>
</template>
<style scoped>
.settings-tabs {
  min-height: 560px;
}

.settings-section {
  max-width: 940px;
  padding: 0 22px;
}

.settings-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 16px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--ops-line);
}

.settings-title h2 {
  margin: 0;
  font-size: 18px;
}

.settings-title p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ops-muted);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}

.span-2 {
  grid-column: span 2;
}

.branding-list {
  max-width: 760px;
}

.asset-setting {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  width: 100%;
}

.asset-setting img {
  width: 120px;
  height: 68px;
  object-fit: contain;
  background: #f1f3f5;
  border: 1px solid var(--ops-line);
  border-radius: 4px;
}

.asset-setting > div {
  display: grid;
  gap: 7px;
}

@media (width <= 760px) {
  .settings-tabs:deep(.el-tabs__header) {
    display: none;
  }

  .settings-section {
    padding: 0;
  }

  .settings-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }

  .asset-setting {
    grid-template-columns: 80px 1fr;
  }

  .asset-setting img {
    width: 80px;
  }
}
</style>
