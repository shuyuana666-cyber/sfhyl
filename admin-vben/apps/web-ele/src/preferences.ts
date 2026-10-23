import {
  appCopyrightPreferences,
  defineOverridesPreferences,
} from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    accessMode: 'backend',
    defaultHomePath: '/dashboard',
    enableCheckUpdates: false,
    enableRefreshToken: true,
    name: import.meta.env.VITE_APP_TITLE,
  },
  copyright: {
    ...appCopyrightPreferences,
    companyName: 'SFHYL',
    enable: false,
  },
  logo: {
    source: '/brand-logo.jpg',
    fit: 'contain',
  },
  theme: {
    colorPrimary: 'hsl(16 89% 39%)',
    colorDestructive: 'hsl(4 74% 40%)',
    radius: '0.375',
    fontSize: 14,
    mode: 'light',
  },
  header: {
    height: 56,
  },
  tabbar: {
    styleType: 'plain',
    height: 40,
  },
});
