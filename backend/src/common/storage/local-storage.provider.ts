import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider, StoredFile } from './storage.interface';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

/** Dev/Phase-1 default: writes to local disk under /uploads, served statically by main.ts. */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  async save(buffer: Buffer, opts: { fileName: string; mimeType: string; folder: string }): Promise<StoredFile> {
    const dir = path.join(UPLOAD_ROOT, opts.folder);
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(opts.fileName) || '';
    const safeName = `${uuid()}${ext}`;
    const fullPath = path.join(dir, safeName);
    fs.writeFileSync(fullPath, buffer);

    return {
      url: `/uploads/${opts.folder}/${safeName}`,
      path: fullPath,
      sizeBytes: buffer.length,
      mimeType: opts.mimeType,
    };
  }
}
