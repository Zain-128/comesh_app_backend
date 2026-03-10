import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Chat } from 'src/chats/chat.schema';
import { User } from 'src/users/user.schema';

export enum MessageTypeEnum {
  TEXT = 'TEXT',
  ATTACHMENT = 'ATTACHMENT',
  BOTH = 'BOTH',
}

export enum MediaTypeEnum {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchemaName = 'Message';

class mediaFiles {
  @Prop()
  url: string;

  @Prop({ type: () => MediaTypeEnum })
  type: MediaTypeEnum;
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ ref: () => User })
  to: Types.ObjectId;

  @Prop({ ref: () => User })
  from: Types.ObjectId;

  @Prop({ ref: () => Chat })
  chatId: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  messageType: MessageTypeEnum;

  @Prop({ required: true })
  mediaFile: mediaFiles;

  @Prop({})
  isRead: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
