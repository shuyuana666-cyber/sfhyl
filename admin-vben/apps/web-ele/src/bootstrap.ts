import { createApp, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { registerLoadingDirective } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { preferences } from '@vben/preferences';
import { initStores, useAccessStore } from '@vben/stores';
import '@vben/styles';
import '@vben/styles/ele';

import { useTitle } from '@vueuse/core';
import {
  ElAlert,
  ElButton,
  ElCheckbox,
  ElCheckboxGroup,
  ElColorPicker,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElImage,
  ElInput,
  ElInputNumber,
  ElLoading,
  ElOption,
  ElPagination,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElSegmented,
  ElSelect,
  ElSkeleton,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
  ElText,
  ElTimeline,
  ElTimelineItem,
  ElTooltip,
  ElUpload,
} from 'element-plus';

import { $t, setupI18n } from '#/locales';

import { initComponentAdapter } from './adapter/component';
import { initSetupVbenForm } from './adapter/form';
import App from './app.vue';
import { router } from './router';

import '../../../../shared/ui-tokens.css';
import '#/sfhyl/legacy/style/operations.scss';

function consumeWebsiteLoginHandoff() {
  if (!window.location.hash.startsWith('#accessToken=')) return;

  const tokens = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = tokens.get('accessToken');
  const refreshToken = tokens.get('refreshToken');
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );

  if (!accessToken || !refreshToken) return;

  const accessStore = useAccessStore();
  accessStore.setAccessToken(accessToken);
  accessStore.setRefreshToken(refreshToken);
  accessStore.setIsAccessChecked(false);
  const homePath =
    import.meta.env.VITE_ROUTER_HISTORY === 'hash'
      ? `/#${preferences.app.defaultHomePath}`
      : preferences.app.defaultHomePath;
  window.history.replaceState(
    window.history.state,
    '',
    homePath,
  );
}

async function bootstrap(namespace: string) {
  // 初始化组件适配器
  await initComponentAdapter();

  // 初始化表单组件
  await initSetupVbenForm();

  // // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   zIndex: 2000,
  // });
  const app = createApp(App);

  // The SFHYL views use Element Plus tags directly, outside Vben's form adapter.
  // Register their UI components at the app level so those pages render as real
  // controls instead of unresolved custom elements.
  const globalComponents = {
    ElAlert,
    ElButton,
    ElCheckbox,
    ElCheckboxGroup,
    ElColorPicker,
    ElDatePicker,
    ElDescriptions,
    ElDescriptionsItem,
    ElDialog,
    ElDrawer,
    ElDropdown,
    ElDropdownItem,
    ElDropdownMenu,
    ElEmpty,
    ElForm,
    ElFormItem,
    ElImage,
    ElInput,
    ElInputNumber,
    ElOption,
    ElPagination,
    ElRadio,
    ElRadioButton,
    ElRadioGroup,
    ElSegmented,
    ElSelect,
    ElSkeleton,
    ElSwitch,
    ElTabPane,
    ElTable,
    ElTableColumn,
    ElTabs,
    ElTag,
    ElText,
    ElTimeline,
    ElTimelineItem,
    ElTooltip,
    ElUpload,
    IconifyIconOnline: IconifyIcon,
  };
  for (const [name, component] of Object.entries(globalComponents)) {
    app.component(name, component);
  }

  // 注册Element Plus提供的v-loading指令
  app.directive('loading', ElLoading.directive);

  // 注册Vben提供的v-loading和v-spinning指令
  registerLoadingDirective(app, {
    loading: false, // Vben提供的v-loading指令和Element Plus提供的v-loading指令二选一即可，此处false表示不注册Vben提供的v-loading指令
    spinning: 'spinning',
  });

  // 国际化 i18n 配置
  await setupI18n(app);

  // 配置 pinia-tore
  await initStores(app, { namespace });
  consumeWebsiteLoginHandoff();

  // 安装权限指令
  registerAccessDirective(app);

  // 初始化 tippy
  const { initTippy } = await import('@vben/common-ui/es/tippy');
  initTippy(app);

  // 配置路由及路由守卫
  app.use(router);

  // 配置Motion插件
  const { MotionPlugin } = await import('@vben/plugins/motion');
  app.use(MotionPlugin);

  // 动态更新标题
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${$t(routeTitle)} - ` : '') + preferences.app.name;
      useTitle(pageTitle);
    }
  });

  app.mount('#app');
}

export { bootstrap };
