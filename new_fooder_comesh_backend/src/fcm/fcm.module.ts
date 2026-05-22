import { Module } from '@nestjs/common';
import { messagingProvider } from './fcm.provider';
import { FCMMessagingService } from './fcm.service';

@Module({
  providers: [messagingProvider, FCMMessagingService],
  exports: [FCMMessagingService],
})
export class MessagingModule {}
