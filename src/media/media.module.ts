import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaService } from './media.service';
import { B2StorageService } from './b2-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [B2StorageService, MediaService],
  exports: [B2StorageService, MediaService],
})
export class MediaModule {}
