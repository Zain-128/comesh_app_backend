import { PartialType } from '@nestjs/mapped-types';
import { CreateChatDto } from './create-chat.dto';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateChatDto extends CreateChatDto {
  @IsNotEmpty()
  @IsString()
  chatId: string;

  @IsOptional()
  @IsBoolean()
  isChatSession?: boolean;

  @IsOptional()
  @IsString()
  chatSessionId?: string;
}
