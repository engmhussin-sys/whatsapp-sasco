import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider, StoredFile } from './storage.interface';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

/**
 * Dev/Phase-1 default: writes to local disk under /uploads, served
 * statically by main.ts.
 *
 * CRITICAL: `url` must be an ABSOLUTE URL (https://domain/uploads/...),
 * not a bare path (/uploads/...) — mobile's Image.network() cannot
 * resolve a relative path and silently falls through to its
 * errorBuilder (a broken-image icon), which is exactly the bug this
 * class previously had. PUBLIC_BASE_URL must be set on Railway to the
 * backend's own public domain, e.g.
 * https://whatsapp-sasco-production.up.railway.app — no trailing slash.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private config: ConfigService) {}

  async save(buffer: Buffer, opts: { fileName: string; mimeType: string; folder: string }): Promise<StoredFile> {
    const dir = path.join(UPLOAD_ROOT, opts.folder);
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(opts.fileName) || '';
    const safeName = `${uuid()}${ext}`;
    const fullPath = path.join(dir, safeName);
    fs.writeFileSync(fullPath, buffer);

    const baseUrl = (this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:3000').replace(/\/$/, '');

    return {
      url: `${baseUrl}/uploads/${opts.folder}/${safeName}`,
      path: fullPath,
      sizeBytes: buffer.length,
      mimeType: opts.mimeType,
    };
  }
}
