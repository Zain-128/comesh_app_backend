import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class VerifyUserDTO {
  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
