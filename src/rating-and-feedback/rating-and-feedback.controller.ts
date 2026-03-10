import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RatingAndFeedbackService } from './rating-and-feedback.service';
import { CreateRatingAndFeedbackDto } from './dto/create-rating-and-feedback.dto';
import { UpdateRatingAndFeedbackDto } from './dto/update-rating-and-feedback.dto';
import { IGetUserAuthInfoRequest } from 'src/interfaces';
import { AuthGuard } from 'src/guards/auth.guard';

@Controller('rating-and-feedback')
export class RatingAndFeedbackController {
  constructor(
    private readonly ratingAndFeedbackService: RatingAndFeedbackService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() createRatingAndFeedbackDto: CreateRatingAndFeedbackDto,
  ) {
    let body = {
      userId: req.user._id,
      ...createRatingAndFeedbackDto,
    };
    return this.ratingAndFeedbackService.create(body);
  }

  @Get()
  findAll() {
    return this.ratingAndFeedbackService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ratingAndFeedbackService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRatingAndFeedbackDto: UpdateRatingAndFeedbackDto,
  ) {
    return this.ratingAndFeedbackService.update(
      +id,
      updateRatingAndFeedbackDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ratingAndFeedbackService.remove(+id);
  }
}
