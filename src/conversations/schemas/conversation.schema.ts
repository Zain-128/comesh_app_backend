import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

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

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ default: '' })
  lastMessage: string;

  @Prop({ default: null })
  lastMessageAt: Date | null;

  @Prop({ type: [UnreadCountSchema], default: [] })
  unreadCounts: UnreadCount[];

  @Prop({ default: false })
  isDeleted: boolean;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes for production performance
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });
