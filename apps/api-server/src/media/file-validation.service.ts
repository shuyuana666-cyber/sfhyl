import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { sanitizeSvg } from '../common/security/sanitize-svg';

const RASTER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_ORIGINAL_NAME_LENGTH = 255;

export interface ValidatedFile {
  content: Buffer;
  mimeType: string;
  extension: string;
  originalName: string;
  width: number | null;
  height: number | null;
}

/**
 * Multer can expose a UTF-8 filename as a latin1 string when parsing a
 * multipart upload. Restore non-Latin names while leaving normal filenames
 * untouched.
 */
export function normalizeUploadFileName(value: string | undefined): string {
  const source = path
    .basename(String(value ?? '').replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (!source) return 'upload';

  let normalized = source;
  // Correct filenames already contain their Unicode code points. Only try to
  // decode the single-byte form Multer may have produced.
  if (!/[^\u0000-\u00ff]/u.test(source)) {
    const bytes = Buffer.from(source, 'latin1');
    const decoded = bytes.toString('utf8');
    const isRoundTrip = !decoded.includes('\ufffd') && Buffer.from(decoded, 'utf8').equals(bytes);
    const containsNonLatinText = /[\u0100-\u{10ffff}]/u.test(decoded);
    if (isRoundTrip && containsNonLatinText) normalized = decoded.normalize('NFC');
  }

  return Array.from(normalized).slice(0, MAX_ORIGINAL_NAME_LENGTH).join('');
}

@Injectable()
export class FileValidationService {
  private readonly maxImageBytes: number;
  private readonly maxVideoBytes: number;

  constructor(config: ConfigService) {
    this.maxImageBytes = config.get<number>('UPLOAD_MAX_IMAGE_MB', 15) * 1024 * 1024;
    this.maxVideoBytes = config.get<number>('UPLOAD_MAX_VIDEO_MB', 100) * 1024 * 1024;
  }

  async validate(file: Express.Multer.File): Promise<ValidatedFile> {
    const input = file?.buffer?.length
      ? file.buffer
      : file?.path
        ? await readFile(file.path)
        : null;
    if (!input?.length) throw new BadRequestException('上传文件为空');
    const detected = await fileTypeFromBuffer(input);
    const isSvg = this.looksLikeSvg(input);
    let content = input;
    let mimeType: string;
    let extension: string;

    if (isSvg) {
      content = this.sanitizeSvg(input);
      mimeType = 'image/svg+xml';
      extension = 'svg';
    } else if (detected && (RASTER_MIMES.has(detected.mime) || VIDEO_MIMES.has(detected.mime))) {
      mimeType = detected.mime;
      extension = detected.ext === 'mov' ? 'mov' : detected.ext;
    } else {
      throw new BadRequestException('仅支持 JPEG、PNG、WebP、GIF、SVG、MP4、WebM 和 MOV 文件');
    }

    const isImage = mimeType.startsWith('image/');
    const maxBytes = isImage ? this.maxImageBytes : this.maxVideoBytes;
    if (content.length > maxBytes) throw new BadRequestException(`文件大小超过 ${Math.round(maxBytes / 1024 / 1024)} MB 限制`);

    let width: number | null = null;
    let height: number | null = null;
    if (isImage) {
      try {
        const metadata = await sharp(content, { limitInputPixels: 100_000_000 }).metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;
      } catch {
        throw new BadRequestException('图片文件无法解析');
      }
    }

    return {
      content,
      mimeType,
      extension,
      originalName: normalizeUploadFileName(file.originalname),
      width,
      height,
    };
  }

  private looksLikeSvg(buffer: Buffer): boolean {
    const start = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8').replace(/^\uFEFF/, '').trimStart();
    return /^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(start);
  }

  private sanitizeSvg(buffer: Buffer): Buffer {
    return Buffer.from(sanitizeSvg(buffer.toString('utf8')), 'utf8');
  }
}
