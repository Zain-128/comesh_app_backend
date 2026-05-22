import { Injectable } from '@nestjs/common';
import { CreateRatingAndFeedbackDto } from './dto/create-rating-and-feedback.dto';
import { UpdateRatingAndFeedbackDto } from './dto/update-rating-and-feedback.dto';
import { Model } from 'mongoose';
import {
  RatingAndFeedBackDocument,
  RatingAndFeedBackSchemaName,
} from './rating-and-feedback.schema';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class RatingAndFeedbackService {
  constructor(
    @InjectModel(RatingAndFeedBackSchemaName)
    private readonly feedbackModel: Model<RatingAndFeedBackDocument>,
  ) {}

  async create(createRatingAndFeedbackDto: CreateRatingAndFeedbackDto) {
    let feedback = await this.feedbackModel.create(createRatingAndFeedbackDto);

    return {
      success: true,
      message: 'This action adds a new ratingAndFeedback',
      data: feedback,
    };
  }

  findAll() {
    return `This action returns all ratingAndFeedback`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ratingAndFeedback`;
  }

  update(id: number, updateRatingAndFeedbackDto: UpdateRatingAndFeedbackDto) {
    return `This action updates a #${id} ratingAndFeedback`;
  }

  remove(id: number) {
    return `This action removes a #${id} ratingAndFeedback`;
  }
}
