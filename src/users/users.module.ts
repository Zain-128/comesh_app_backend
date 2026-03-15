import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserSchema } from './user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UserDevicesModule } from 'src/user-devices/user-devices.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TwilioModule } from '../providers/twilio/twilio.module';
import { MessagingModule } from 'src/fcm/fcm.module';
import { SendgridService } from 'src/sendgrid/sendgrid.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    NotificationsModule,
    UserDevicesModule,
    TwilioModule,
    MessagingModule,
    ConfigModule,
  ],
  exports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }])],
  providers: [UsersService, SendgridService],
  controllers: [UsersController],
})
export class UsersModule {}
