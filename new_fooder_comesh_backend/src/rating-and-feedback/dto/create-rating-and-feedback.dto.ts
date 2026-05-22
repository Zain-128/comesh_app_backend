import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Types } from 'mongoose';

export class CreateRatingAndFeedbackDto {
  //   @Type(() => Types.ObjectId)
  //   @IsNotEmpty()
  //   userId: Types.ObjectId;

  @IsOptional()
  @IsString()
  feedback: string;

  @IsOptional()
  @IsNumber()
  rating: string;
}
