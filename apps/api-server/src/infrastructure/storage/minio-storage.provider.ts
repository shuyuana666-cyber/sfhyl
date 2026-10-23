import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver } from '@prisma/client';
import { Client } from 'minio';
import type { StoreObjectInput, StoredObject } from './storage-provider';
import { publicStorageUrl } from './storage-settings';

@Injectable()
export class MinioStorageProvider {
  readonly driver = StorageDriver.MINIO;
  private readonly client: Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    const endPoint = config.get<string>('MINIO_ENDPOINT', '127.0.0.1');
    const port = config.get<number>('MINIO_PORT', 9000);
    const useSSL = config.get<boolean>('MINIO_USE_SSL', false);
    this.bucket = config.get<string>('MINIO_BUCKET', 'sfhyl');
    this.client = new Client({
      endPoint,
      port,
      useSSL,
      accessKey: config.get<string>('MINIO_ACCESS_KEY') || 'unused-local-provider',
      secretKey: config.get<string>('MINIO_SECRET_KEY') || 'unused-local-provider-secret',
      region: config.get<string>('MINIO_REGION') || undefined,
      pathStyle: config.get<boolean>('MINIO_PATH_STYLE', true),
      sessionToken: config.get<string>('MINIO_SESSION_TOKEN') || undefined,
    });
    this.publicUrl = publicStorageUrl(config, 'minio');
  }

  async putObject(input: StoreObjectInput): Promise<StoredObject> {
    await this.client.putObject(this.bucket, input.objectKey, input.content, input.content.length, {
      'Content-Type': input.mimeType,
    });
    return {
      driver: this.driver,
      bucket: this.bucket,
      objectKey: input.objectKey,
      url: `${this.publicUrl}/${input.objectKey.split('/').map(encodeURIComponent).join('/')}`,
    };
  }

  async deleteObject(objectKey: string, bucket?: string | null): Promise<void> {
    await this.client.removeObject(bucket || this.bucket, objectKey);
  }

  async checkHealth(): Promise<void> {
    if (!(await this.client.bucketExists(this.bucket))) throw new Error(`MinIO bucket ${this.bucket} does not exist.`);
  }
}
