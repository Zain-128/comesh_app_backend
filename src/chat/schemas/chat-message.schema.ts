import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CHAT_SCHEMA_NAME } from './chat.schema';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

export const CHAT_MESSAGE_SCHEMA_NAME = 'ChatMessage';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: CHAT_SCHEMA_NAME, required: true })
  chat: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ default: '' })
  content: string;

  @Prop({ enum: ['text', 'image', 'video', 'audio', 'file'], default: 'text' })
  messageType: MessageType;

  @Prop({ default: false })
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ chat: 1, createdAt: -1 });
