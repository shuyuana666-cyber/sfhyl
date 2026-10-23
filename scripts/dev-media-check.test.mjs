import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPublishedImages, localImagePaths } from './dev-media-check.mjs';

test('mixed local and legacy MinIO images are checked through the website proxy', () => {
  assert.deepEqual(localImagePaths([{
    old: 'http://localhost:9200/sfhyl/cars/car.webp',
    normalized: '/media/cars/car.webp',
    local: 'http://localhost:3002/uploads/car.png',
    external: 'https://example.com/media/car.webp',
    video: '/media/video.mp4',
    otherBucket: 'http://localhost:9200/unrelated/car.webp',
  }]), ['/media/cars/car.webp', '/uploads/car.png']);
});

test('startup reports missing image dependencies even when API health is successful', async () => {
  const calls = [];
  const result = await checkPublishedImages({ request: async (url, options) => {
    calls.push({ url, method: options.method });
    if (url.endsWith('/pages/about')) return new Response(null, { status: 404 });
    if (url.includes('/api/v1/public/')) {
      return Response.json({ image: 'http://localhost:9200/sfhyl/car.webp' });
    }
    return new Response(null, { status: 502 });
  } });
  assert.equal(result.checked, 1);
  assert.deepEqual(result.failures, [{ path: '/media/car.webp', error: 'HTTP 502' }]);
  assert.equal(calls.filter((call) => call.method === 'HEAD').length, 1);
});

test('API errors are visible and successful media produce a clean result', async () => {
  const healthy = await checkPublishedImages({ request: async (url) =>
    url.includes('/api/v1/public/')
      ? Response.json({ image: '/uploads/car.png' })
      : new Response(null, { status: 200 }),
  });
  assert.deepEqual(healthy, { checked: 1, failures: [] });
  const failed = await checkPublishedImages({ request: async () => {
    throw new Error('connection refused');
  } });
  assert.equal(failed.failures.length, 5);
  assert.equal(failed.checked, 0);
});
