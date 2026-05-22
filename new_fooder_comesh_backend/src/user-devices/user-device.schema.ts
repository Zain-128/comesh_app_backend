import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { User } from 'src/users/user.schema';

export type UserDeviceDocument = HydratedDocument<UserDevice>;

@Schema({ timestamps: true })
export class UserDevice {
  @Prop({ ref: () => User })
  userId: Types.ObjectId;

  @Prop({ required: true })
  deviceType: string;

  @Prop({})
  deviceToken: string;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserDeviceSchema = SchemaFactory.createForClass(UserDevice);
