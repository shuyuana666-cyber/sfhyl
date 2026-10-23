import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { MinioStorageProvider } from './minio-storage.provider';
import { StorageProvider } from './storage-provider';
import { AliyunOssStorageProvider } from './aliyun-oss-storage.provider';
import { TencentCosStorageProvider } from './tencent-cos-storage.provider';
import { StorageRegistry } from './storage-registry';

@Global()
@Module({
  providers: [
    LocalStorageProvider,
    MinioStorageProvider,
    AliyunOssStorageProvider,
    TencentCosStorageProvider,
    {
      provide: StorageRegistry,
      inject: [LocalStorageProvider, MinioStorageProvider, AliyunOssStorageProvider, TencentCosStorageProvider],
      useFactory: (...providers: StorageProvider[]) => new StorageRegistry(providers),
    },
    {
      provide: StorageProvider,
      inject: [
        ConfigService,
        LocalStorageProvider,
        MinioStorageProvider,
        AliyunOssStorageProvider,
        TencentCosStorageProvider,
      ],
      useFactory: (
        config: ConfigService,
        local: LocalStorageProvider,
        minio: MinioStorageProvider,
        aliyunOss: AliyunOssStorageProvider,
        tencentCos: TencentCosStorageProvider,
      ): StorageProvider => {
        const providers: Record<string, StorageProvider> = {
          local,
          minio,
          'aliyun-oss': aliyunOss,
          'tencent-cos': tencentCos,
        };
        return providers[config.get<string>('STORAGE_DRIVER', 'local')] ?? local;
      },
    },
  ],
  exports: [StorageProvider, LocalStorageProvider, StorageRegistry],
})
export class StorageModule {}
