import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChatDocument = HydratedDocument<Chat>;
export const chatSchemaName = 'Chat';



@Schema({ timestamps: true })
export class Chat {
  @Prop({})
  chatName: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  users: Types.ObjectId[];

  @Prop({})
  latestMessage: string;

  @Prop({})
  latestMessageTime: string;

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        unReadMessageCount: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  unReadMessage: { userId: Types.ObjectId; unReadMessageCount: number }[];

  @Prop({ default: false })
  isChatSession: boolean;

  @Prop({})
  chatSessionId: string;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
