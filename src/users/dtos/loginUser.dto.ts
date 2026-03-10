import {
  IsBoolean,
  IsEmail,
  IsEmpty,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { DeviceTypeEnum, PlatformEnum } from './enums';

export class LoginDTO {
  @IsOptional()
  @IsString()
  phoneNo?: string; // Now optional

  @IsEmail()
  @IsNotEmpty()
  email: string; // Required field

  @IsBoolean()
  @IsNotEmpty()
  pushNotification?: boolean;

  @ValidateIf((object) => object.pushNotification === true)
  @IsString()
  @IsNotEmpty()
  deviceToken?: string;
}
