import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsEnum,
  ValidateIf,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { PlatformEnum, DeviceTypeEnum } from '../../users/dtos/enums';

export class CreateSocialAuthDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsString()
  @IsOptional()
  phoneNo?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(PlatformEnum)
  @IsNotEmpty()
  platform: PlatformEnum; // auth type

  @IsBoolean()
  @IsNotEmpty()
  pushNotification?: boolean;

  @ValidateIf((object) => object.pushNotification === true)
  @IsString()
  @IsNotEmpty()
  @IsEnum(DeviceTypeEnum)
  deviceType?: DeviceTypeEnum;

  @ValidateIf((object) => object.pushNotification === true)
  @IsString()
  @IsNotEmpty()
  deviceToken?: string;
}
