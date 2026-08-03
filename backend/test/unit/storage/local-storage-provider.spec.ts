import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { LocalStorageProvider } from '../../../src/common/storage/local-storage.provider';

jest.mock('fs');

describe('LocalStorageProvider — absolute URL fix', () => {
  let provider: LocalStorageProvider;
  let config: any;

  beforeEach(async () => {
    config = { get: jest.fn() };
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [LocalStorageProvider, { provide: ConfigService, useValue: config }],
    }).compile();

    provider = moduleRef.get(LocalStorageProvider);
  });

  it('returns a FULL absolute URL using PUBLIC_BASE_URL — not a bare relative path', async () => {
    config.get.mockReturnValue('https://whatsapp-sasco-production.up.railway.app');

    const result = await provider.save(Buffer.from('fake image bytes'), {
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      folder: 'message-attachments/company-A',
    });

    expect(result.url).toMatch(/^https:\/\/whatsapp-sasco-production\.up\.railway\.app\/uploads\/message-attachments\/company-A\/.+\.jpg$/);
  });

  it('strips a trailing slash from PUBLIC_BASE_URL to avoid a double-slash in the URL', async () => {
    config.get.mockReturnValue('https://example.com/');

    const result = await provider.save(Buffer.from('x'), { fileName: 'a.png', mimeType: 'image/png', folder: 'f' });

    expect(result.url.startsWith('https://example.com/uploads/')).toBe(true);
    expect(result.url).not.toContain('.com//uploads');
  });

  it('falls back to localhost when PUBLIC_BASE_URL is not configured (local dev)', async () => {
    config.get.mockReturnValue(undefined);

    const result = await provider.save(Buffer.from('x'), { fileName: 'a.png', mimeType: 'image/png', folder: 'f' });

    expect(result.url.startsWith('http://localhost:3000/uploads/')).toBe(true);
  });
});
