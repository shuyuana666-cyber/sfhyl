import type { StorageDriver } from '@prisma/client';
import type { StorageProvider } from './storage-provider';

export class StorageRegistry {
  constructor(private readonly providers: StorageProvider[]) {}

  forDriver(driver: StorageDriver): StorageProvider {
    const provider = this.providers.find(item => item.driver === driver);
    if (!provider) throw new Error(`Unsupported storage driver: ${driver}`);
    return provider;
  }
}
