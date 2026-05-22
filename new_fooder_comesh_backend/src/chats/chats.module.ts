import { Module, forwardRef } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';
import { ChatSchema, chatSchemaName } from './chat.schema';
import { UserSchema } from '../users/user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatsGateway } from './chats.gateway';
import { MessagesModule } from '../messages/messages.module';
import { JwtModule } from '@nestjs/jwt';

import { MessagingModule } from '../fcm/fcm.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: chatSchemaName, schema: ChatSchema },
      { name: 'User', schema: UserSchema }
    ]),
    forwardRef(() => MessagesModule),
    JwtModule.register({}),
    MessagingModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
  exports: [ChatsService, ChatsGateway],
})
export class ChatsModule { }
