import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class BlockUserDTO {
  @IsString()
  @IsNotEmpty()
  userToBlock: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
