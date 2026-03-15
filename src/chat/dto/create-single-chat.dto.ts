import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSingleChatDto {
  @IsNotEmpty()
  @IsString()
  otherUserId: string;
}
