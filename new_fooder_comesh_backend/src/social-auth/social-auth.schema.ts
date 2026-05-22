import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { PlatformEnum } from 'src/users/dtos/enums';

export type SocialAuthDocument = HydratedDocument<SocialAuth>;

@Schema({ timestamps: true })
export class SocialAuth {
  @Prop({ required: true, unique: true })
  clientId: string;

  @Prop({})
  email: string;

  @Prop({})
  fullName: string;

  @Prop({ required: true, enum: PlatformEnum })
  platform: PlatformEnum;

  @Prop({})
  deviceType: string;

  @Prop({})
  deviceToken: string;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  stripeCustomerId: string;
}

export const SocialAuthSchema = SchemaFactory.createForClass(SocialAuth);
