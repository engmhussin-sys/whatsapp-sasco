import { Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage.interface';
import { LocalStorageProvider } from './local-storage.provider';
import { ImageMetaExtractorService } from './image-meta-extractor.service';
import { VideoThumbnailExtractorService } from './video-thumbnail-extractor.service';

@Module({
  providers: [
    { provide: STORAGE_PROVIDER, useClass: LocalStorageProvider },
    ImageMetaExtractorService,
    VideoThumbnailExtractorService,
  ],
  exports: [STORAGE_PROVIDER, ImageMetaExtractorService, VideoThumbnailExtractorService],
})
export class StorageModule {}
