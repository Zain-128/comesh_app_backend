import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNotificationsDto {
  @IsOptional()
  @IsBoolean()
  pushNotificationEnabled?: boolean;

  @IsOptional()
  @IsString()
  deviceToken?: string;
}
