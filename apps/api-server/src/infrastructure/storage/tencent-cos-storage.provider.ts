import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver } from '@prisma/client';
import { CloudStorageSkeletonProvider } from './cloud-storage-skeleton.provider';

export interface TencentCosStorageConfig {
  region: string;
  secretId: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
}

@Injectable()
export class TencentCosStorageProvider extends CloudStorageSkeletonProvider {
  readonly driver = StorageDriver.TENCENT_COS;
  protected readonly providerName = 'Tencent COS';
  protected readonly bucketName: string;
  readonly options: TencentCosStorageConfig;

  constructor(config: ConfigService) {
    super();
    this.options = {
      region: config.get<string>('TENCENT_COS_REGION', ''),
      secretId: config.get<string>('TENCENT_COS_SECRET_ID', ''),
      secretKey: config.get<string>('TENCENT_COS_SECRET_KEY', ''),
      bucket: config.get<string>('TENCENT_COS_BUCKET', ''),
      publicUrl: config.get<string>('TENCENT_COS_PUBLIC_URL', ''),
    };
    this.bucketName = this.options.bucket || '(not configured)';
  }
}
