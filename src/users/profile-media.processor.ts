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

    try {
      if (job.profileImage) {
        patch.profileImage = await this.mediaService.processImageUpload(
          job.profileImage,
          host,
          `${userId}_pimg_${stamp}`,
        );
      }

      let videoArr: VideoEntry[] = job.emptyVideos
        ? []
        : [...job.previousVideos];

      if (job.galleryVideos.length) {
        const processed = await Promise.all(
          job.galleryVideos.map((file, i) =>
            this.mediaService.processUploadedVideo(
              file,
              host,
              `${userId}_v_${stamp}_${i}`,
            ),
          ),
        );
        videoArr = [
          ...videoArr,
          ...processed.map((p) => ({
            url: p.url,
            thumbnailUrl: p.thumbnailUrl || undefined,
          })),
        ];
        patch.videos = videoArr;
      } else if (job.emptyVideos) {
        patch.videos = [];
      } else if (job.previousVideos.length) {
        patch.videos = videoArr;
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

      await this.userModel
        .findByIdAndUpdate(userId, { $set: patch }, { new: true })
        .exec();

      this.logger.log(`[profileMedia] done userId=${userId}`);
    } catch (e: any) {
      this.logger.error(
        `[profileMedia] failed userId=${userId}: ${e?.message ?? e}`,
        e?.stack,
      );
      await this.userModel
        .findByIdAndUpdate(userId, { $set: { mediaProcessing: false } })
        .exec();
    }
  }
}
