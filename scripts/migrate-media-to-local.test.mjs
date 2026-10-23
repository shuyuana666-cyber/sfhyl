import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { copyVerifiedObject, localObjectPath } from './migrate-media-to-local.mjs';

test('migration exports raw object bytes and verifies copies and repeated runs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sfhyl-migration-'));
  try {
    const content = Buffer.from('original image bytes');
    const copy = () => copyVerifiedObject({ root, key: '2026/10/image.thumb.webp', source: Readable.from([content]), expectedSize: content.length });
    const first = await copy();
    assert.equal(first.reused, false);
    assert.deepEqual(await readFile(path.join(root, '2026/10/image.thumb.webp')), content);
    assert.deepEqual(await copy(), { ...first, reused: true });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('migration preserves conflicting existing files and rejects truncated source bytes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sfhyl-migration-'));
  try {
    await writeFile(path.join(root, 'image.webp'), 'existing image');
    await assert.rejects(copyVerifiedObject({ root, key: 'image.webp', source: Readable.from(['different image']), expectedSize: 15 }), /preserved without overwrite/);
    assert.equal(await readFile(path.join(root, 'image.webp'), 'utf8'), 'existing image');
    await assert.rejects(copyVerifiedObject({ root, key: 'truncated.webp', source: Readable.from(['short']), expectedSize: 10 }), /verification failed/);
    await assert.rejects(readFile(path.join(root, 'truncated.webp')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('migration rejects paths outside the configured upload folder', () => {
  for (const key of ['../outside.webp', '/outside.webp', '2026//image.webp', 'C:\\outside.webp', '2026/image..webp']) {
    assert.throws(() => localObjectPath(path.join(tmpdir(), 'sfhyl-migration'), key), /Unsafe object key/);
  }
});
