import { Module, forwardRef } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessageSchema, MessageSchemaName } from './message.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatsModule } from 'src/chats/chats.module';
import { MediaModule } from 'src/media/media.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MessageSchemaName, schema: MessageSchema },
    ]),
    forwardRef(() => ChatsModule),
    MediaModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule { }
