import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';

/**
 * Backblaze B2 via S3-compatible API.
 * Env: B2_KEY_ID, B2_APPLICATION_KEY, B2_S3_ENDPOINT, B2_BUCKET, B2_PUBLIC_URL_BASE,
 *      B2_REGION (default us-west-004)
 * B2_PUBLIC_URL_BASE: public file base, e.g. https://f005.backblazeb2.com/file/your-bucket
 */
@Injectable()
export class B2StorageService {
  private readonly logger = new Logger(B2StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    const keyId = this.config.get<string>('B2_KEY_ID');
    const appKey = this.config.get<string>('B2_APPLICATION_KEY');
    const endpoint = this.config.get<string>('B2_S3_ENDPOINT');
    const bucket = this.config.get<string>('B2_BUCKET') || '';
    const pub = (this.config.get<string>('B2_PUBLIC_URL_BASE') || '').replace(
      /\/$/,
      '',
    );

    if (keyId && appKey && endpoint && bucket && pub) {
      const region = this.config.get<string>('B2_REGION') || 'us-west-004';
      this.client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId: keyId,
          secretAccessKey: appKey,
        },
        forcePathStyle: true,
      });
      this.bucket = bucket;
      this.publicBase = pub;
      this.logger.log('Backblaze B2 storage enabled');
    } else {
      this.client = null;
      this.bucket = '';
      this.publicBase = '';
      this.logger.log(
        'Backblaze B2 not configured; image/video files stay on local disk',
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  buildPublicUrl(objectKey: string): string {
    const safe = objectKey
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    return `${this.publicBase}/${safe}`;
  }

  async uploadLocalFile(
    localPath: string,
    objectKey: string,
    contentType?: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('B2 not configured');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: createReadStream(localPath),
        ContentType: contentType || 'application/octet-stream',
      }),
    );
    return this.buildPublicUrl(objectKey);
  }

  async uploadLocalAndUnlink(
    localPath: string,
    objectKey: string,
    contentType?: string,
  ): Promise<string> {
    const url = await this.uploadLocalFile(localPath, objectKey, contentType);
    await this.safeUnlink(localPath);
    return url;
  }

  private async safeUnlink(p: string): Promise<void> {
    try {
      await fs.unlink(p);
    } catch {
      /* ignore */
    }
  }
}
