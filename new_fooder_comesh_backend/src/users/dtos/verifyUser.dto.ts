import { IsEmail, IsOptional, IsString, IsNotEmpty, ValidateIf } from 'class-validator';

export class VerifyUserDTO {
  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsOptional()
  @ValidateIf((o) => !o.phoneNo)
  @IsEmail()
  @IsNotEmpty({ message: 'email or phone number is required' })
  email?: string;

  @IsOptional()
  @ValidateIf((o) => !o.email)
  @IsString()
  @IsNotEmpty({ message: 'email or phone number is required' })
  phoneNo?: string;

  /** FCM token — saved on verify so message pushes work after OTP. */
  @IsOptional()
  @IsString()
  deviceToken?: string;
}
