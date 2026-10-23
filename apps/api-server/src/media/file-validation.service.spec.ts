import { normalizeUploadFileName } from './file-validation.service';

describe('normalizeUploadFileName', () => {
  it('restores a UTF-8 Chinese filename supplied as latin1 by multipart parsing', () => {
    const originalName = '截图 2026-07-28.png';
    const multerName = Buffer.from(originalName, 'utf8').toString('latin1');

    expect(normalizeUploadFileName(multerName)).toBe(originalName);
  });

  it('preserves correctly decoded and ASCII filenames', () => {
    expect(normalizeUploadFileName('办公室图片.png')).toBe('办公室图片.png');
    expect(normalizeUploadFileName('vehicle-cover.webp')).toBe('vehicle-cover.webp');
  });

  it('removes path prefixes and control characters', () => {
    expect(normalizeUploadFileName('C:\\fakepath\\图片\u0000.png')).toBe('图片.png');
  });
});
