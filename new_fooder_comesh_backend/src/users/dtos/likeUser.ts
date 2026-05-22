import { IsString, IsNotEmpty } from 'class-validator';

export class LikeUserDTO {
  @IsString()
  @IsNotEmpty()
  userLikedByMe: string;
}
