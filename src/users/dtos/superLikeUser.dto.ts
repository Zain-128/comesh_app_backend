import { IsString, IsNotEmpty } from 'class-validator';

export class SuperLikeUserDTO {
  @IsString()
  @IsNotEmpty()
  userSuperLikedByMe: string;
}
