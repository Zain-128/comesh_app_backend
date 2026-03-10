import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from 'src/users/user.schema';
import { NotificationEnum } from './enums';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ ref: () => User })
  to: Types.ObjectId; // reciever

  @Prop({ ref: () => User })
  from: Types.ObjectId; // notification of this user

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: () => Boolean, default: false })
  isRead: boolean;

  @Prop({ required: true, enum: NotificationEnum })
  type: string;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
