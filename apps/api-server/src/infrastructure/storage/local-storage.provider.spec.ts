import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { MediaProcessingService } from '../../media/media-processing.service';
import { LocalStorageProvider } from './local-storage.provider';

describe('LocalStorageProvider', () => {
  let root: string;
  let config: ConfigService;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'sfhyl-storage-test-'));
    config = new ConfigService({ LOCAL_STORAGE_PATH: root, STORAGE_PUBLIC_URL: '/uploads' });
    storage = new LocalStorageProvider(config);
  });

  afterEach(async () => {
    const relative = path.relative(tmpdir(), root);
    if (!relative.startsWith('sfhyl-storage-test-') || relative.includes(path.sep)) {
      throw new Error('Unexpected test directory');
    }
    await rm(root, { recursive: true, force: true });
  });

  it('stores an uploaded PNG and its generated WebP thumbnail using real local storage', async () => {
    const processing = new MediaProcessingService(config, storage);
    const content = await sharp({ create: { width: 640, height: 360, channels: 4, background: '#f5f5f5' } }).png().toBuffer();
    const processed = await processing.convertToWebp({
      content, originalName: '媒体占位图片1.png', extension: 'png', mimeType: 'image/png', width: 640, height: 360,
    });
    const original = await storage.putObject({
      objectKey: '2026/10/test-image.webp', content: processed.content, mimeType: processed.mimeType,
    });
    const derivatives = await processing.storeDerivatives(processed, original);
    expect(derivatives.thumbnail?.objectKey).toBe('2026/10/test-image.thumb.webp');
    expect(derivatives.webp).toEqual(original);
    const thumbnail = await readFile(path.join(root, derivatives.thumbnail!.objectKey));
    expect((await sharp(thumbnail).metadata()).width).toBe(480);
    await storage.deleteObject(derivatives.thumbnail!.objectKey);
    await expect(readFile(path.join(root, derivatives.thumbnail!.objectKey))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['../outside.webp', '2026/../outside.webp', '/outside.webp', '2026//image.webp', '2026/image..webp', 'C:\\outside.webp', '2026\\image.webp'])(
    'rejects invalid object key %s', async objectKey => {
      await expect(storage.putObject({ objectKey, content: Buffer.from('test'), mimeType: 'image/webp' }))
        .rejects.toThrow('Unsafe storage object key.');
    },
  );
});
