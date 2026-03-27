import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

class Location {
  @Prop({ default: 'Point' })
  type: string;

  @Prop({ type: [Number] })
  coordinates: Number[];
}

class video {
  @Prop()
  url: string;

  @Prop()
  thumbnailUrl?: string;
}

class OtpInfo {
  @Prop()
  otp: string;

  @Prop()
  expiresIn: boolean;
}

class questionAndAnswer {
  @Prop()
  question: string;

  @Prop()
  answer: string;
}

class socialMediaProfiles {
  @Prop()
  facebook: string;

  @Prop()
  instagram: string;

  @Prop()
  twitter: string;

  @Prop()
  youtube: string;

  @Prop()
  tiktok: string;
}

export let socialMediaProfilesDefaultValues = {
  facebook: '',
  instagram: '',
  twitter: '',
  youtube: '',
  tiktok: '',
};

@Schema({ timestamps: true })
export class User {
  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  description: string;

  @Prop({})
  phoneNo: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ default: '' })
  dob: string;

  @Prop({ type: Location, index: '2dsphere' })
  location: Location;

  @Prop({})
  address: String;

  @Prop({})
  niche: [String];

  @Prop({ type: [video], default: [] })
  videos: video[];

  @Prop({ default: false })
  willingToTravel: boolean;

  @Prop({ default: 0 })
  followers: number;

  @Prop({
    type: () => socialMediaProfiles,
    default: socialMediaProfilesDefaultValues,
  })
  socialMediaProfiles: socialMediaProfiles;

  @Prop({ default: '' })
  availability: Date;

  @Prop({ default: '' })
  availabilityTo: string;

  @Prop({ default: '' })
  availabilityFrom: string;

  @Prop({ default: '' })
  timeZone: string;

  @Prop({ default: false })
  showLocation: boolean;

  @Prop({ type: () => [questionAndAnswer], default: [] })
  questionAndAnswers: questionAndAnswer[];

  @Prop({})
  blockUsers: [string];

  @Prop({ default: [] })
  likedByMe: [string]; // users whom i like

  @Prop({ default: [] })
  unLikedByMe: [string]; // users whom i don't like

  @Prop({ default: [] })
  likedBySomeone: [string]; // users who like me.

  @Prop({ default: [] })
  connections: [string]; // actual connections

  @Prop({})
  pendingConnections: [string]; // expected to be my connection, or just this user swipe up to someone for conneciton

  @Prop({ default: false })
  pushNotificationEnabled: boolean;

  @Prop({ default: 'USER' })
  role: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: '' })
  reasonToDeleteAccount: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isPackageSubscribed: boolean; // currently any package is subscribed or not

  @Prop({ default: true })
  isFirstTime: boolean;

  @Prop({ default: '' })
  deviceToken: string;

  @Prop({ default: '' })
  profileImage: string;

  @Prop({})
  profileVideo: string;

  /** JPEG preview for profile video (server-generated) */
  @Prop({ default: '' })
  profileVideoThumbnail: string;

  @Prop({})
  gender: string;

  @Prop({ default: 0 })
  superLikeCount: number;

  @Prop({})
  otpInfo: OtpInfo;

  @Prop({ enum: ['ACTIVE', 'INACTIVE', 'PENDING'], default: 'PENDING' })
  status: string;

  @Prop()
  lastSeenChatTime: string;

  /** Chat IDs for listing: single + group chats */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Chat' }], default: [] })
  chatIds: Types.ObjectId[];

  @Prop()
  pronouns: string;

  @Prop()
  password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
