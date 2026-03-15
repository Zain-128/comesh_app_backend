import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class LoginDTO {
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

  @IsOptional()
  @IsBoolean()
  pushNotification?: boolean;

  @ValidateIf((o) => o.pushNotification === true)
  @IsOptional()
  @IsString()
  deviceToken?: string;
}
