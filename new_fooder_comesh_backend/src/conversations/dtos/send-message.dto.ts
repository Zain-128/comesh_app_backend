import { IsMongoId, IsNotEmpty, IsOptional, IsString, IsIn, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  receiverId: string;

  /** Text content or image URL when type is image */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  /** Legacy: same as content for text messages */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  text?: string;

  @IsOptional()
  @IsIn(['text', 'image'])
  type?: 'text' | 'image';
}
