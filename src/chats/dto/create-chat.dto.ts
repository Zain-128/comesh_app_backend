import { Type } from 'class-transformer';
import { IsString, IsArray, ArrayMinSize, IsOptional } from 'class-validator';
import { Types } from 'mongoose';

export class CreateChatDto {
  @IsOptional()
  @IsString()
  chatName: string;

  @IsArray()
  @Type(() => Types.ObjectId)
  @ArrayMinSize(2)
  users: Types.ObjectId[];

  @IsOptional()
  @IsString()
  latestMessage: string;
}
