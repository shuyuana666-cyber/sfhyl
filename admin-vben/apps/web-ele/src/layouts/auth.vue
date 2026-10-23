<script lang="ts" setup>
import { computed } from 'vue';

import { AuthPageLayout } from '@vben/layouts';
import { preferences, updatePreferences } from '@vben/preferences';


const appName = computed(() => preferences.app.name);
const logo = computed(() => preferences.logo.source);
const logoDark = computed(() => preferences.logo.sourceDark);

// Entering the login page starts in day mode, including when a previous
// session stored a dark theme. Users can still change the theme afterwards.
updatePreferences({ theme: { mode: 'light' } });
</script>

<template>
  <AuthPageLayout
    class="sfhyl-auth"
    :app-name="appName"
    :logo="logo"
    :logo-dark="logoDark"
    page-description="管理车辆、客户询盘与网站内容"
    page-title="SFHYL 运营工作台"
  >
    <!-- 自定义工具栏 -->
    <!-- <template #toolbar></template> -->
  </AuthPageLayout>
</template>
