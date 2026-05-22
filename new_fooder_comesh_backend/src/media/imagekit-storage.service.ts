import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { basename, dirname } from 'path';

@Injectable()
export class ImageKitStorageService {
  private readonly logger = new Logger(ImageKitStorageService.name);
  private readonly privateKey: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const publicKey =
      this.config.get<string>('IMAGE_KIT_PUBLIC_KEY') ||
      this.config.get<string>('IMAGE_KIT_PUCLIC_KEY');
    const privateKey = this.config.get<string>('IMAGE_KIT_PRIVATE_KEY');
    const urlEndpoint = this.config.get<string>('IMAGE_BASE_URL');

    if (publicKey && privateKey && urlEndpoint) {
      this.privateKey = String(privateKey).trim().replace(/^"|"$/g, '');
      this.enabled = true;
      this.logger.log(
        `ImageKit storage enabled publicKeyPrefix=${String(publicKey).slice(0, 12)}… urlEndpoint=${urlEndpoint}`,
      );
    } else {
      this.privateKey = '';
      this.enabled = false;
      this.logger.warn(
        `ImageKit not configured (missing ${[!publicKey && 'IMAGE_KIT_PUBLIC_KEY', !privateKey && 'IMAGE_KIT_PRIVATE_KEY', !urlEndpoint && 'IMAGE_BASE_URL'].filter(Boolean).join(', ') || 'env'})`,
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private ensureEnabled(): void {
    if (!this.enabled || !this.privateKey) {
      throw new Error('ImageKit is not configured');
    }
  }

  private toImageKitPathParts(objectKey: string) {
    const safe = String(objectKey || '').replace(/^\/+/, '');
    const fileName = basename(safe) || `file-${Date.now()}`;
    const folderPath = dirname(safe).replace(/^\.+/, '').replace(/\\/g, '/');
    const folder = folderPath && folderPath !== '.' ? `/${folderPath}` : '/';
    return { fileName, folder };
  }

  async uploadLocalFile(
    localPath: string,
    objectKey: string,
    _contentType?: string,
  ): Promise<string> {
    this.ensureEnabled();
    const { fileName, folder } = this.toImageKitPathParts(objectKey);
    const stat = await fs.stat(localPath).catch(() => null);
    this.logger.log(
      `[ImageKit upload] folder=${folder} fileName=${fileName} bytes=${stat?.size ?? '?'}`,
    );
    const file = await fs.readFile(localPath);
    const form = new FormData();
    form.append('file', `data:application/octet-stream;base64,${file.toString('base64')}`);
    form.append('fileName', fileName);
    form.append('folder', folder);
    form.append('useUniqueFileName', 'true');

    const auth = Buffer.from(`${this.privateKey}:`).toString('base64');
    const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: form,
    });
    const uploaded = await res.json();
    if (!res.ok || !uploaded?.url) {
      this.logger.error(
        `[ImageKit upload] failed status=${res.status} message=${uploaded?.message ?? JSON.stringify(uploaded).slice(0, 400)}`,
      );
      throw new Error(uploaded?.message || 'ImageKit upload failed');
    }
    this.logger.log(`[ImageKit upload] ok url=${uploaded.url}`);
    return uploaded.url;
  }

  async uploadLocalAndUnlink(
    localPath: string,
    objectKey: string,
    contentType?: string,
  ): Promise<string> {
    try {
      return await this.uploadLocalFile(localPath, objectKey, contentType);
    } finally {
      try {
        await fs.unlink(localPath);
      } catch {
        /* ignore cleanup failure */
      }
    }
  }
}
