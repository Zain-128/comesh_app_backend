import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { MediaTypeEnum, MessageTypeEnum } from '../message.schema';

class mediaFile {
  @IsString()
  url: string;

  @IsString()
  type: MediaTypeEnum;
}

export class CreateMessageDto {
  @Type(() => Types.ObjectId)
  @IsNotEmpty()
  to: Types.ObjectId;

  @Type(() => Types.ObjectId)
  @IsNotEmpty()
  from: Types.ObjectId;

  @Type(() => Types.ObjectId)
  @IsNotEmpty()
  chatId: Types.ObjectId;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  messageType: MessageTypeEnum;

  @IsOptional()
  mediaFile?: any;

  /** If set, server copies a snapshot from this message (must belong to the same chat). */
  @IsOptional()
  @IsString()
  replyToMessageId?: string;
}
