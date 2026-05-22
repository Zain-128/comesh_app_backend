import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { HttpException, HttpStatus } from '@nestjs/common';

import { Type, Transform } from 'class-transformer';
import { Types } from 'mongoose';

export function toMongoObjectId({ value, key }): Types.ObjectId {
  if (
    Types.ObjectId.isValid(value) &&
    new Types.ObjectId(value).toString() === value
  ) {
    return new Types.ObjectId(value);
  } else {
    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid object id',
        success: false,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class CreateUserDeviceDto {
  @IsNotEmpty()
  @Type(() => Types.ObjectId)
  @Transform(toMongoObjectId)
  userId: string;

  @IsEmail()
  @IsNotEmpty()
  deviceType: string;

  @IsString()
  @IsNotEmpty()
  deviceToken: string;
}
