import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver } from '@prisma/client';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type { StoreObjectInput, StoredObject } from './storage-provider';
import { publicStorageUrl } from './storage-settings';

@Injectable()
export class LocalStorageProvider {
  readonly driver = StorageDriver.LOCAL;
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('LOCAL_STORAGE_PATH', './storage'));
    this.publicUrl = publicStorageUrl(config, 'local');
  }

  async putObject(input: StoreObjectInput): Promise<StoredObject> {
    const target = this.safePath(input.objectKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.content, { flag: 'wx' });
    return {
      driver: this.driver,
      bucket: null,
      objectKey: input.objectKey,
      url: `${this.publicUrl}/${input.objectKey.split('/').map(encodeURIComponent).join('/')}`,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    try {
      await unlink(this.safePath(objectKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async checkHealth(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root, constants.R_OK | constants.W_OK);
  }

  getRoot(): string {
    return this.root;
  }

  private safePath(objectKey: string): string {
    // Image derivatives use compound names such as UUID.thumb.webp. Validate
    // each segment so those names work while traversal and empty segments fail.
    if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/.test(objectKey)) {
      throw new Error('Unsafe storage object key.');
    }
    const target = path.resolve(this.root, objectKey);
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error('Storage path escapes configured root.');
    return target;
  }
}
