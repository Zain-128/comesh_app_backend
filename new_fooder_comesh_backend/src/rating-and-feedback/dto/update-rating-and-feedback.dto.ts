import { PartialType } from '@nestjs/mapped-types';
import { CreateRatingAndFeedbackDto } from './create-rating-and-feedback.dto';

export class UpdateRatingAndFeedbackDto extends PartialType(CreateRatingAndFeedbackDto) {}
