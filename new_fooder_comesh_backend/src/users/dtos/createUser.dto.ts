import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsEnum,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import { PlatformEnum, DeviceTypeEnum } from './enums';

export class CreateUserDTO {
  @IsString()
  // @IsNotEmpty()
  fullName: string;

  @IsString()
  // @IsNotEmpty()
  phoneNo: string;

  @IsEmail()
  // @IsNotEmpty()
  email: string;

  @IsString()
  // @IsNotEmpty()
  password: string;

  @IsEnum(PlatformEnum)
  // @IsNotEmpty()
  platform: PlatformEnum; // auth type

  @IsBoolean()
  // @IsNotEmpty()
  pushNotification?: boolean;

  @ValidateIf((object) => object.pushNotification === true)
  @IsString()
  // @IsNotEmpty()
  @IsEnum(DeviceTypeEnum)
  deviceType?: DeviceTypeEnum;

  @ValidateIf((object) => object.pushNotification === true)
  @IsString()
  // @IsNotEmpty()
  deviceToken?: string;
}
