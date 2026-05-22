import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { isAbsolute, join, resolve } from 'path';
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

  /** Multer may store a relative path; ffmpeg needs an absolute path that exists on disk. */
  private async resolveExistingUploadPath(
    file: Express.Multer.File,
  ): Promise<string> {
    const candidates = [
      file.path,
      join(process.cwd(), file.path),
      join(process.cwd(), 'uploads', file.filename),
    ].filter(Boolean) as string[];

    for (const raw of candidates) {
      const abs = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
      try {
        await fs.access(abs);
        return abs;
      } catch {
        /* try next */
      }
    }

    throw new Error(
      `Uploaded file missing on disk (tried: ${candidates.join(', ')}). ` +
        'On Render, redeploy after uploads/ path fix; retry the upload.',
    );
  }

  /**
   * Compress/transcode to H.264 MP4 (max width 960, CRF 26), faststart for streaming.
   * No separate thumbnail pass — UI uses video URL or client picker stills.
   */
  private async transcodeToMp4(inputPath: string, outputPath: string): Promise<void> {
    const withAudio = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      "scale='min(960,iw)':-2",
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '26',
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
      "scale='min(960,iw)':-2",
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '26',
      '-an',
      '-movflags',
      '+faststart',
      outputPath,
    ];
    await execFileAsync(this.ffmpegPath, videoOnly);
  }

  /**
   * Compress + strip EXIF; max dimension 1920, JPEG.
   */
  async processImageUpload(
    file: Express.Multer.File,
    _host: string,
    baseName: string,
  ): Promise<string> {
    const inputPath = await this.resolveExistingUploadPath(file);
    this.logger.log(
      `[processImageUpload] in mimetype=${file?.mimetype} size=${file?.size} baseName=${baseName} path=${inputPath}`,
    );
    await this.ensureProcessedDir();
    const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '');
    const outName = `${safeBase}.jpg`;
    const outPath = join(this.processedDir, outName);
    try {
      await sharp(inputPath, { failOn: 'none' })
        .rotate()
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(outPath);
    } catch (e: any) {
      this.logger.error(
        `processImageUpload sharp failed for ${file?.mimetype ?? '?'}: ${e?.message ?? e}`,
      );
      throw new Error(
        `Could not process profile image (${e?.message || 'unsupported or corrupt file'}). Try another photo or export as JPEG.`,
      );
    }
    this.logger.log(`[processImageUpload] sharp ok out=${outName}`);
    await this.safeUnlink(inputPath);

    if (!this.imagekit.isEnabled()) {
      throw new Error('ImageKit is not configured');
    }
    const key = `processed/${outName}`;
    this.logger.log(`[processImageUpload] ImageKit upload key=${key}`);
    const url = await this.imagekit.uploadLocalAndUnlink(outPath, key, 'image/jpeg');
    this.logger.log(`[processImageUpload] done url=${url}`);
    return url;
  }

  /**
   * Compress uploaded video (single ffmpeg pass) → ImageKit MP4.
   * thumbnailUrl left empty; app uses compressed video or profile image for posters.
   */
  async processUploadedVideo(
    file: Express.Multer.File,
    _host: string,
    uniquePrefix: string,
  ): Promise<{ url: string; thumbnailUrl: string }> {
    const inputPath = await this.resolveExistingUploadPath(file);
    this.logger.log(
      `[processUploadedVideo] compress in mimetype=${file?.mimetype} size=${file?.size} prefix=${uniquePrefix} path=${inputPath}`,
    );

    const safePrefix = uniquePrefix.replace(/[^a-zA-Z0-9_-]/g, '');
    const outMp4Name = `${safePrefix}.mp4`;
    const outMp4Path = join(this.processedDir, outMp4Name);

    try {
      await this.ensureProcessedDir();
      await this.transcodeToMp4(inputPath, outMp4Path);
      this.logger.log(`[processUploadedVideo] compress ok out=${outMp4Name}`);
      await this.safeUnlink(inputPath);

      if (!this.imagekit.isEnabled()) {
        throw new Error('ImageKit is not configured');
      }
      const keyMp4 = `processed/${outMp4Name}`;
      this.logger.log(`[processUploadedVideo] ImageKit upload mp4 key=${keyMp4}`);
      const url = await this.imagekit.uploadLocalFile(
        outMp4Path,
        keyMp4,
        'video/mp4',
      );
      await this.safeUnlink(outMp4Path);
      this.logger.log(`[processUploadedVideo] done url=${url.slice(0, 64)}…`);
      return { url, thumbnailUrl: '' };
    } catch (e: any) {
      this.logger.error(`Video compress/upload failed: ${e?.message ?? e}`);
      await this.safeUnlink(inputPath);
      await this.safeUnlink(outMp4Path);
      throw e;
    }
  }
}
