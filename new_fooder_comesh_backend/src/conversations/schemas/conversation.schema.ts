import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

export const CONVERSATION_SCHEMA_NAME = 'Conversation';

@Schema({ _id: false })
export class UnreadCount {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ default: 0 })
  count: number;
}

const UnreadCountSchema = SchemaFactory.createForClass(UnreadCount);

/**
 * Production Chat schema (one-to-one).
 * chatId: deterministic from sorted user ids (userA_userB).
 * unreadCount: object keyed by userId for fast per-user unread.
 */
@Schema({ timestamps: true })
export class Conversation {
  /** Deterministic id: sorted user ids joined (userA < userB ? userA_userB : userB_userA) */
  @Prop({ required: false, unique: true, sparse: true, index: true })
  chatId?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'ConversationMessage', default: null })
  lastMessageId: Types.ObjectId | null;

  @Prop({ default: '' })
  lastMessage: string;

  /** 'text' | 'image' for chat list preview */
  @Prop({ default: 'text' })
  lastMessageType: string;

  @Prop({ default: null })
  lastMessageAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  lastMessageSenderId: Types.ObjectId | null;

  /** Per-user unread count: { "userId1": number, "userId2": number } */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  unreadCount: Record<string, number>;

  /** Legacy array form (kept for migration); prefer unreadCount object */
  @Prop({ type: [UnreadCountSchema], default: [] })
  unreadCounts: UnreadCount[];

  @Prop({ default: false })
  isDeleted: boolean;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ participants: 1, updatedAt: -1 });
ConversationSchema.index({ chatId: 1 });
ConversationSchema.index({ updatedAt: -1 });
