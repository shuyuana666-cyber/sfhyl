import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { StorageProvider } from '../infrastructure/storage/storage-provider';
import type { StoredObject } from '../infrastructure/storage/storage-provider';
import type { ValidatedFile } from './file-validation.service';

const MAX_IMAGE_PIXELS = 100_000_000;
const THUMBNAIL_WEBP_QUALITY = 82;
const DERIVATIVE_WEBP_QUALITY = 86;

export interface MediaDerivatives {
  objects: StoredObject[];
  thumbnail?: StoredObject;
  webp?: StoredObject;
}

@Injectable()
export class MediaProcessingService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageProvider,
  ) {}

  async convertToWebp(file: ValidatedFile): Promise<ValidatedFile> {
    if (!['image/jpeg', 'image/png'].includes(file.mimeType)) return file;

    const maxDimension = this.config.get<number>('MEDIA_IMAGE_MAX_DIMENSION', 2560);
    const quality = this.config.get<number>('MEDIA_WEBP_QUALITY', 82);
    const content = await sharp(file.content, { limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
    const metadata = await sharp(content, {
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();

    return {
      ...file,
      content,
      originalName: this.fileNameWithExtension(file.originalName, 'webp'),
      mimeType: 'image/webp',
      extension: 'webp',
      width: metadata.width ?? file.width,
      height: metadata.height ?? file.height,
    };
  }

  async storeDerivatives(
    file: ValidatedFile,
    original: StoredObject,
  ): Promise<MediaDerivatives> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType)) {
      return { objects: [] };
    }

    const baseKey = original.objectKey.replace(/\.[^.]+$/, '');
    const objects: StoredObject[] = [];
    let thumbnail: StoredObject | undefined;
    let webp: StoredObject | undefined;

    try {
      if (this.config.get<boolean>('MEDIA_GENERATE_THUMBNAILS', true)) {
        const content = await sharp(file.content, {
          limitInputPixels: MAX_IMAGE_PIXELS,
        })
          .rotate()
          .resize({
            width: this.config.get<number>('MEDIA_THUMBNAIL_WIDTH', 480),
            withoutEnlargement: true,
          })
          .webp({ quality: THUMBNAIL_WEBP_QUALITY })
          .toBuffer();
        thumbnail = await this.storage.putObject({
          objectKey: `${baseKey}.thumb.webp`,
          content,
          mimeType: 'image/webp',
        });
        objects.push(thumbnail);
      }

      if (this.config.get<boolean>('MEDIA_GENERATE_WEBP', true)) {
        if (file.mimeType === 'image/webp') {
          webp = original;
        } else {
          const content = await sharp(file.content, {
            limitInputPixels: MAX_IMAGE_PIXELS,
          })
            .rotate()
            .webp({ quality: DERIVATIVE_WEBP_QUALITY })
            .toBuffer();
          webp = await this.storage.putObject({
            objectKey: `${baseKey}.webp`,
            content,
            mimeType: 'image/webp',
          });
          objects.push(webp);
        }
      }
    } catch (error) {
      await Promise.all(
        objects.map((item) =>
          this.storage.deleteObject(item.objectKey).catch(() => undefined),
        ),
      );
      throw error;
    }

    return { objects, thumbnail, webp };
  }

  private fileNameWithExtension(name: string, extension: string): string {
    const base = name.replace(/\.[^.]+$/, '').trim() || 'image';
    return `${base}.${extension}`;
  }
}
