import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import {
  ConversationSchema,
  CONVERSATION_SCHEMA_NAME,
} from './schemas/conversation.schema';
import {
  ConversationMessageSchema,
  CONVERSATION_MESSAGE_SCHEMA_NAME,
} from './schemas/message.schema';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsGateway } from './conversations.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CONVERSATION_SCHEMA_NAME, schema: ConversationSchema },
      { name: CONVERSATION_MESSAGE_SCHEMA_NAME, schema: ConversationMessageSchema },
    ]),
    JwtModule.register({}),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsGateway],
  exports: [ConversationsService, ConversationsGateway],
})
export class ConversationsModule {}
