import { Module } from '@nestjs/common';
import { SocialAuthService } from './social-auth.service';
import { SocialAuthController } from './social-auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { SocialAuthSchema } from './social-auth.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SocialAuth', schema: SocialAuthSchema },
    ]),
  ],
  controllers: [SocialAuthController],
  providers: [SocialAuthService],
})
export class SocialAuthModule {}
