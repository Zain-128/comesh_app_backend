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
import { RatingAndFeedbackModule } from './rating-and-feedback/rating-and-feedback.module';
import { PackagesModule } from './packages/packages.module';
import { ChatModule } from './chat/chat.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ContactModule } from './contact/contact.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { SendgridService } from './sendgrid/sendgrid.service';

const clientPath = join(__dirname, '..', 'client');
const serveClient = existsSync(clientPath) && process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    ...(serveClient
      ? [ServeStaticModule.forRoot({ rootPath: clientPath })]
      : []),
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
    RatingAndFeedbackModule,
    PackagesModule,
    ChatModule,
    SubscriptionsModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [AppService, SendgridService],
})
export class AppModule {}
