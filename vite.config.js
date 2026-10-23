import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const localStorage = (process.env.STORAGE_DRIVER || env.STORAGE_DRIVER || 'local') === 'local';
  const minioProtocol = (process.env.MINIO_USE_SSL || env.MINIO_USE_SSL) === 'true' ? 'https' : 'http';
  const minioHost = process.env.MINIO_ENDPOINT || env.MINIO_ENDPOINT || '127.0.0.1';
  const minioPort = process.env.MINIO_PORT || env.MINIO_PORT || '9200';
  const bucket = process.env.MINIO_BUCKET || env.MINIO_BUCKET || 'sfhyl';
  const pathStyle = (process.env.MINIO_PATH_STYLE || env.MINIO_PATH_STYLE) !== 'false';
  const minioTarget = `${minioProtocol}://${pathStyle ? minioHost : `${bucket}.${minioHost}`}:${minioPort}`;
  const mediaProxy = localStorage
    ? { target: 'http://127.0.0.1:3002' }
    : { target: minioTarget, changeOrigin: true, rewrite: (path) => path.replace(/^\/media\//, pathStyle ? `/${bucket}/` : '/') };
  return {
    plugins: [react()],
    server: {
      strictPort: true,
      proxy: {
        '/admin/': {
          target: 'http://127.0.0.1:5777',
          changeOrigin: true,
          ws: true,
        },
        '/api/v1': 'http://127.0.0.1:3002',
        '/uploads/': 'http://127.0.0.1:3002',
        '/media/': mediaProxy,
      },
    },
  };
});
