import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CONVERSATION_SCHEMA_NAME } from './conversation.schema';

export type ConversationMessageDocument = HydratedDocument<ConversationMessage>;

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export const CONVERSATION_MESSAGE_SCHEMA_NAME = 'ConversationMessage';

@Schema({ timestamps: true })
export class ConversationMessage {
  @Prop({ type: Types.ObjectId, ref: CONVERSATION_SCHEMA_NAME, required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiverId: Types.ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop({ enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  @Prop({ default: null })
  readAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationMessageSchema = SchemaFactory.createForClass(ConversationMessage);

// Indexes for pagination and queries
ConversationMessageSchema.index({ conversationId: 1, createdAt: -1 });
ConversationMessageSchema.index({ conversationId: 1 });
ConversationMessageSchema.index({ senderId: 1, receiverId: 1 });
