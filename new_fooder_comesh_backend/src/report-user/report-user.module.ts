import { Module } from '@nestjs/common';
import { ReportUserService } from './report-user.service';
import { ReportUserController } from './report-user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportUserSchema } from './report-user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ReportUser', schema: ReportUserSchema },
    ]),
  ],
  controllers: [ReportUserController],
  providers: [ReportUserService],
})
export class ReportUserModule {}
