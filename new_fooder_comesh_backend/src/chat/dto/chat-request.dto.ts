import { IsNotEmpty, IsString } from 'class-validator';

export class ChatRequestDto {
  @IsNotEmpty()
  @IsString()
  chatId: string;
}
