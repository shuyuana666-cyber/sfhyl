import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { defineConfig, viteCssLayerPlugin } from '@vben/vite-config';

import ElementPlus from 'unplugin-element-plus/vite';
import { loadEnv } from 'vite';

const sfhylLegacyRoot = fileURLToPath(
  new URL('./src/sfhyl/legacy', import.meta.url),
);
const sfhylAuthAdapter = fileURLToPath(
  new URL('./src/sfhyl/adapters/auth.ts', import.meta.url),
);
const sfhylAdminDist = fileURLToPath(
  new URL('../../../apps/admin-web/dist', import.meta.url),
);

export default defineConfig(async () => {
  const env = loadEnv('development', fileURLToPath(new URL('../../../', import.meta.url)), '');
  const localStorage = (process.env.STORAGE_DRIVER || env.STORAGE_DRIVER || 'local') === 'local';
  const minioProtocol = (process.env.MINIO_USE_SSL || env.MINIO_USE_SSL) === 'true' ? 'https' : 'http';
  const minioHost = process.env.MINIO_ENDPOINT || env.MINIO_ENDPOINT || '127.0.0.1';
  const minioPort = process.env.MINIO_PORT || env.MINIO_PORT || '9200';
  const bucket = process.env.MINIO_BUCKET || env.MINIO_BUCKET || 'sfhyl';
  const pathStyle = (process.env.MINIO_PATH_STYLE || env.MINIO_PATH_STYLE) !== 'false';
  const minioTarget = `${minioProtocol}://${pathStyle ? minioHost : `${bucket}.${minioHost}`}:${minioPort}`;
  return {
    application: {},
    vite: {
      plugins: [
        // element-plus 的 css 包进 @layer el，使 Tailwind 工具类可覆盖组件样式
        viteCssLayerPlugin({ layerName: 'el', packageName: 'element-plus' }),
        ElementPlus({ format: 'esm' }),
      ],
      resolve: {
        alias: [
          { find: '@/utils/auth', replacement: sfhylAuthAdapter },
          { find: '@', replacement: sfhylLegacyRoot },
        ],
      },
      server: {
        host: '127.0.0.1',
        proxy: {
          '/api': {
            changeOrigin: true,
            target: 'http://127.0.0.1:3002',
            ws: true,
          },
          '/media/': {
            changeOrigin: true,
            target: localStorage ? 'http://127.0.0.1:3002' : minioTarget,
            rewrite: (path: string) => localStorage ? path : path.replace(/^\/media\//, pathStyle ? `/${bucket}/` : '/'),
          },
          '/uploads/': {
            changeOrigin: true,
            target: 'http://127.0.0.1:3002',
          },
        },
      },
      build: {
        emptyOutDir: true,
        outDir: sfhylAdminDist,
      },
    },
  };
});
