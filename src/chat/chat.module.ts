import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { Chat, ChatSchema, CHAT_SCHEMA_NAME } from './schemas/chat.schema';
import {
  ChatMessage,
  ChatMessageSchema,
  CHAT_MESSAGE_SCHEMA_NAME,
} from './schemas/chat-message.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: CHAT_SCHEMA_NAME, schema: ChatSchema },
      { name: CHAT_MESSAGE_SCHEMA_NAME, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
