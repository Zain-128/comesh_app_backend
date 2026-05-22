import { IsNotEmpty, IsPhoneNumber } from 'class-validator';
import { SendOtpTypeEnum } from './enums';

export class SendOtpDTO {
  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNo: string;
}
