import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaService } from './media.service';
import { ImageKitStorageService } from './imagekit-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [ImageKitStorageService, MediaService],
  exports: [ImageKitStorageService, MediaService],
})
export class MediaModule {}
