import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import { ImageKitStorageService } from './imagekit-storage.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly ffmpegPath = ffmpegInstaller.path;
  private readonly processedDir = join(process.cwd(), 'uploads', 'processed');

  constructor(private readonly imagekit: ImageKitStorageService) {}

  private async ensureProcessedDir(): Promise<void> {
    await fs.mkdir(this.processedDir, { recursive: true });
  }

  private async safeUnlink(p: string): Promise<void> {
    try {
      await fs.unlink(p);
    } catch {
      /* ignore */
    }
  }

  /**
   * Transcode to H.264 MP4 (max width 1280), faststart for streaming.
   * Falls back to video-only if audio track causes issues.
   */
  private async transcodeToMp4(inputPath: string, outputPath: string): Promise<void> {
    const withAudio = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      "scale='min(1280,iw)':-2",
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    try {
      await execFileAsync(this.ffmpegPath, withAudio);
      return;
    } catch (e: any) {
      this.logger.warn(`Transcode with audio failed, retrying video-only: ${e?.message ?? e}`);
    }
    const videoOnly = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      "scale='min(1280,iw)':-2",
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-an',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    await execFileAsync(this.ffmpegPath, videoOnly);
  }

  private async extractThumbnail(
    videoPath: string,
    outputJpgPath: string,
  ): Promise<boolean> {
    const attempts: string[][] = [
      ['-y', '-ss', '00:00:01', '-i', videoPath, '-frames:v', '1', '-q:v', '2', outputJpgPath],
      ['-y', '-ss', '00:00:00.250', '-i', videoPath, '-frames:v', '1', '-q:v', '2', outputJpgPath],
      ['-y', '-i', videoPath, '-frames:v', '1', '-q:v', '2', outputJpgPath],
    ];
    for (const args of attempts) {
      try {
        await execFileAsync(this.ffmpegPath, args);
        return true;
      } catch {
        /* try next */
      }
    }
    return false;
  }

  /**
   * Compress + strip EXIF; max dimension 1920, JPEG.
   */
  async processImageUpload(
    file: Express.Multer.File,
    _host: string,
    baseName: string,
  ): Promise<string> {
    await this.ensureProcessedDir();
    const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '');
    const outName = `${safeBase}.jpg`;
    const outPath = join(this.processedDir, outName);
    await sharp(file.path)
      .rotate()
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(outPath);
    await this.safeUnlink(file.path);

    if (!this.imagekit.isEnabled()) {
      throw new Error('ImageKit is not configured');
    }
    const key = `processed/${outName}`;
    return this.imagekit.uploadLocalAndUnlink(outPath, key, 'image/jpeg');
  }

  /**
   * Transcode uploaded video, generate thumbnail, delete original upload.
   * On failure, returns original multer URLs (legacy behaviour).
   */
  async processUploadedVideo(
    file: Express.Multer.File,
    _host: string,
    uniquePrefix: string,
  ): Promise<{ url: string; thumbnailUrl: string }> {
    const inputPath = file.path;

    const safePrefix = uniquePrefix.replace(/[^a-zA-Z0-9_-]/g, '');
    const outMp4Name = `${safePrefix}.mp4`;
    const outThumbName = `${safePrefix}_thumb.jpg`;
    const outMp4Path = join(this.processedDir, outMp4Name);
    const outThumbPath = join(this.processedDir, outThumbName);

    try {
      await this.ensureProcessedDir();
      await this.transcodeToMp4(inputPath, outMp4Path);
      const thumbOk = await this.extractThumbnail(outMp4Path, outThumbPath);
      await this.safeUnlink(inputPath);

      if (!this.imagekit.isEnabled()) {
        throw new Error('ImageKit is not configured');
      }
      const keyMp4 = `processed/${outMp4Name}`;
      const keyThumb = `processed/${outThumbName}`;
      const url = await this.imagekit.uploadLocalFile(
        outMp4Path,
        keyMp4,
        'video/mp4',
      );
      let thumbnailUrl = '';
      if (thumbOk) {
        thumbnailUrl = await this.imagekit.uploadLocalFile(
          outThumbPath,
          keyThumb,
          'image/jpeg',
        );
      }
      await this.safeUnlink(outMp4Path);
      if (thumbOk) await this.safeUnlink(outThumbPath);
      return { url, thumbnailUrl };
    } catch (e: any) {
      this.logger.error(`Video processing/upload failed: ${e?.message ?? e}`);
      await this.safeUnlink(inputPath);
      await this.safeUnlink(outMp4Path);
      await this.safeUnlink(outThumbPath);
      throw e;
    }
  }
}
