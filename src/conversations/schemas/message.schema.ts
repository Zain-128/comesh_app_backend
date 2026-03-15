import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CONVERSATION_SCHEMA_NAME } from './conversation.schema';

export type ConversationMessageDocument = HydratedDocument<ConversationMessage>;

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  SEEN = 'seen',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
}

export const CONVERSATION_MESSAGE_SCHEMA_NAME = 'ConversationMessage';

@Schema({ timestamps: true })
export class ConversationMessage {
  @Prop({ type: Types.ObjectId, ref: CONVERSATION_SCHEMA_NAME, required: true })
  conversationId: Types.ObjectId;

  /** Chat id string (deterministic) for quick lookup */
  @Prop({ required: true, index: true })
  chatId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiverId: Types.ObjectId;

  /** Text content or image URL when type is image */
  @Prop({ required: true, default: '' })
  content: string;

  @Prop({ enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  @Prop({ default: null })
  readAt: Date | null;

  /** Preview: same as content for text, '[Photo]' for image */
  @Prop({ default: '' })
  text: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationMessageSchema = SchemaFactory.createForClass(ConversationMessage);

ConversationMessageSchema.index({ conversationId: 1, createdAt: -1 });
ConversationMessageSchema.index({ chatId: 1, createdAt: -1 });
ConversationMessageSchema.index({ senderId: 1, receiverId: 1 });
