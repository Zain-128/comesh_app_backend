import { Module } from '@nestjs/common';
import { RatingAndFeedbackService } from './rating-and-feedback.service';
import { RatingAndFeedbackController } from './rating-and-feedback.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RatingAndFeedBackSchemaName,
  RatingAndFeedBackSchema,
} from './rating-and-feedback.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RatingAndFeedBackSchemaName, schema: RatingAndFeedBackSchema },
    ]),
  ],
  controllers: [RatingAndFeedbackController],
  providers: [RatingAndFeedbackService],
})
export class RatingAndFeedbackModule {}
