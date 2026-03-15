import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type ChatDocument = HydratedDocument<Chat>;

export const CHAT_SCHEMA_NAME = 'Chat';

/** requestStatus for 1:1 chat request flow */
export type RequestStatus = 'pending' | 'accepted' | 'rejected';

@Schema({ timestamps: true })
export class Chat {
  /** 2 users (single) or more (group) */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  users: Types.ObjectId[];

  @Prop({ default: false })
  isGroup: boolean;

  @Prop({ type: Types.ObjectId, ref: 'ChatMessage', default: null })
  lastMessage: Types.ObjectId | null;

  @Prop({ default: null })
  lastMessageAt: Date | null;

  @Prop({ enum: ['pending', 'accepted', 'rejected'], default: 'accepted' })
  requestStatus: RequestStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  requestedBy: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  requestedTo: Types.ObjectId | null;

  /** Per-user last read time for unread count: userId string -> Date */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  lastReadAt: Record<string, Date>;

  /** Group-only */
  @Prop({ default: '' })
  groupName: string;

  @Prop({ default: '' })
  groupImage: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  groupAdmins: Types.ObjectId[];
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
ChatSchema.index({ users: 1 });
ChatSchema.index({ lastMessageAt: -1 });
ChatSchema.index({ requestedTo: 1, requestStatus: 1 });
