import type { StorageDriver } from '@prisma/client';

export interface StoreObjectInput {
  objectKey: string;
  content: Buffer;
  mimeType: string;
}

export interface StoredObject {
  driver: StorageDriver;
  bucket: string | null;
  objectKey: string;
  url: string;
}

export abstract class StorageProvider {
  abstract readonly driver: StorageDriver;
  abstract putObject(input: StoreObjectInput): Promise<StoredObject>;
  abstract deleteObject(objectKey: string, bucket?: string | null): Promise<void>;
  abstract checkHealth(): Promise<void>;
}
