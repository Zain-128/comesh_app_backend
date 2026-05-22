import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { ResetPasswordTypeEnum } from './enums';

export class ResetPasswordDTO {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(ResetPasswordTypeEnum)
  @IsNotEmpty()
  type: ResetPasswordTypeEnum;

  @ValidateIf((object) => object.type === ResetPasswordTypeEnum.CHANGE_PASSWORD)
  @IsString()
  @IsNotEmpty()
  oldPassword?: string;

  @ValidateIf((object) => object.type === ResetPasswordTypeEnum.RESET_PASSWORD)
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
