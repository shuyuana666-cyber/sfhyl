import { NotImplementedException } from '@nestjs/common';
import type { StorageDriver } from '@prisma/client';
import { StorageProvider, type StoredObject } from './storage-provider';

export abstract class CloudStorageSkeletonProvider extends StorageProvider {
  abstract readonly driver: StorageDriver;
  protected abstract readonly providerName: string;
  protected abstract readonly bucketName: string;

  putObject(): Promise<StoredObject> {
    return Promise.reject(this.notImplemented());
  }

  deleteObject(): Promise<void> {
    return Promise.reject(this.notImplemented());
  }

  checkHealth(): Promise<void> {
    return Promise.reject(this.notImplemented());
  }

  private notImplemented(): NotImplementedException {
    return new NotImplementedException(
      `${this.providerName} storage adapter for bucket ${this.bucketName} is a configuration skeleton; install and connect the vendor SDK before selecting this driver.`,
    );
  }
}
