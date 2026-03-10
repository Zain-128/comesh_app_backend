import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { RoleModule } from './role/role.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { UserDevicesModule } from './user-devices/user-devices.module';
import { SocialAuthModule } from './social-auth/social-auth.module';
import { JwtModule } from '@nestjs/jwt';
import { CategoriesModule } from './categories/categories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportUserModule } from './report-user/report-user.module';
import { StaticContentModule } from './static-content/static-content.module';
import { ReasonsModule } from './reasons/reasons.module';
import { ChatsModule } from './chats/chats.module';
import { MessagesModule } from './messages/messages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { RatingAndFeedbackModule } from './rating-and-feedback/rating-and-feedback.module';
import { PackagesModule } from './packages/packages.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SendgridService } from './sendgrid/sendgrid.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '360d' },
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT as unknown as number,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_ID, // generated ethereal user
          pass: process.env.EMAIL_PASS, // generated ethereal password
        },
      },
      defaults: {
        from: '"nest-modules" <comesh@gmail.com>', // outgoing email ID
      },
    }),

    MongooseModule.forRoot(
      process.env.NODE_ENV === 'production'
        ? process.env.MONGO_URL_ATLAS
        : process.env.MONGO_URL_ATLAS,
    ),
    UsersModule,
    RoleModule,
    UserDevicesModule,
    SocialAuthModule,
    CategoriesModule,
    NotificationsModule,
    ReportUserModule,
    StaticContentModule,
    ReasonsModule,
    ChatsModule,
    MessagesModule,
    ConversationsModule,
    RatingAndFeedbackModule,
    PackagesModule,
    SubscriptionsModule,

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client'), // <-- path to the static files
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SendgridService],
})
export class AppModule {}
