import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver } from '@prisma/client';
import { CloudStorageSkeletonProvider } from './cloud-storage-skeleton.provider';

export interface AliyunOssStorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  publicUrl: string;
}

@Injectable()
export class AliyunOssStorageProvider extends CloudStorageSkeletonProvider {
  readonly driver = StorageDriver.ALIYUN_OSS;
  protected readonly providerName = 'Aliyun OSS';
  protected readonly bucketName: string;
  readonly options: AliyunOssStorageConfig;

  constructor(config: ConfigService) {
    super();
    this.options = {
      endpoint: config.get<string>('ALIYUN_OSS_ENDPOINT', ''),
      region: config.get<string>('ALIYUN_OSS_REGION', ''),
      accessKeyId: config.get<string>('ALIYUN_OSS_ACCESS_KEY_ID', ''),
      accessKeySecret: config.get<string>('ALIYUN_OSS_ACCESS_KEY_SECRET', ''),
      bucket: config.get<string>('ALIYUN_OSS_BUCKET', ''),
      publicUrl: config.get<string>('ALIYUN_OSS_PUBLIC_URL', ''),
    };
    this.bucketName = this.options.bucket || '(not configured)';
  }
}
