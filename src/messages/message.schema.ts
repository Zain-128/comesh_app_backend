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

  /** Only set for ATTACHMENT / BOTH; plain TEXT messages have no media. */
  @Prop({ required: false })
  mediaFile?: mediaFiles;

  /** WhatsApp-style quote: snapshot of the message being replied to (same chat). */
  @Prop({
    type: {
      _id: { type: Types.ObjectId, ref: 'Message' },
      message: { type: String, default: '' },
      messageType: { type: String },
      from: { type: Types.ObjectId, ref: 'User' },
      mediaFile: {
        url: { type: String },
        type: { type: String },
      },
    },
    required: false,
    _id: false,
  })
  replyTo?: {
    _id: Types.ObjectId;
    message: string;
    messageType: string;
    from: Types.ObjectId;
    mediaFile?: { url: string; type: string };
  };

  @Prop({})
  isRead: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
