import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MediaService } from 'src/media/media.service';
import { UserDocument } from './user.schema';

type VideoEntry = { url: string; thumbnailUrl?: string };

export type ProfileMediaJob = {
  userId: string;
  host: string;
  stamp: number;
  previousVideos: VideoEntry[];
  emptyVideos: boolean;
  profileImage?: Express.Multer.File;
  profileVideo?: Express.Multer.File;
  galleryVideos: Express.Multer.File[];
};

@Injectable()
export class ProfileMediaProcessorService {
  private readonly logger = new Logger(ProfileMediaProcessorService.name);

  constructor(
    private readonly mediaService: MediaService,
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
  ) {}

  /** Respond to client first; ffmpeg + ImageKit run after the HTTP response. */
  schedule(job: ProfileMediaJob): void {
    setImmediate(() => {
      void this.run(job);
    });
  }

  private async run(job: ProfileMediaJob): Promise<void> {
    const { userId, host, stamp } = job;
    const patch: Record<string, unknown> = { mediaProcessing: false };
    let failed = false;

    try {
      if (job.profileImage) {
        patch.profileImage = await this.mediaService.processImageUpload(
          job.profileImage,
          host,
          `${userId}_pimg_${stamp}`,
        );
      }

      if (job.profileVideo) {
        const processed = await this.mediaService.processUploadedVideo(
          job.profileVideo,
          host,
          `${userId}_pv_${stamp}`,
        );
        patch.profileVideo = processed.url;
        patch.profileVideoThumbnail = processed.thumbnailUrl || '';
      }

      let videoArr: VideoEntry[] = job.emptyVideos
        ? []
        : [...job.previousVideos];

      if (job.galleryVideos.length) {
        const processed: { url: string; thumbnailUrl?: string }[] = [];
        for (let i = 0; i < job.galleryVideos.length; i++) {
          const p = await this.mediaService.processUploadedVideo(
            job.galleryVideos[i],
            host,
            `${userId}_v_${stamp}_${i}`,
          );
          processed.push({
            url: p.url,
            thumbnailUrl: p.thumbnailUrl || undefined,
          });
        }
        videoArr = [...videoArr, ...processed];
        patch.videos = videoArr;
      } else if (job.emptyVideos) {
        patch.videos = [];
      } else if (job.previousVideos.length) {
        patch.videos = videoArr;
      }

      await this.userModel
        .findByIdAndUpdate(userId, { $set: patch }, { new: true })
        .exec();

      this.logger.log(`[profileMedia] done userId=${userId}`);
    } catch (e: any) {
      failed = true;
      this.logger.error(
        `[profileMedia] failed userId=${userId}: ${e?.message ?? e}`,
        e?.stack,
      );
    } finally {
      if (failed) {
        await this.userModel
          .findByIdAndUpdate(userId, { $set: { mediaProcessing: false } })
          .exec();
      }
    }
  }
}
