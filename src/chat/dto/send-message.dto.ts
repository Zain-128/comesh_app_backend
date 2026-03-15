import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  chatId: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'image', 'video', 'audio', 'file'])
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file';
}
