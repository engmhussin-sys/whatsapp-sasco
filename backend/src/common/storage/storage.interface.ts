/**
 * Storage abstraction so Messages/Task attachments can move from local
 * disk (Phase 1 dev default) to S3/GCS/Azure Blob later without touching
 * calling code. Swap the provider in StorageModule only.
 */
export interface StoredFile {
  url: string;
  path: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageProvider {
  save(buffer: Buffer, opts: { fileName: string; mimeType: string; folder: string }): Promise<StoredFile>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
