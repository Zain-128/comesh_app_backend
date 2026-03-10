import { IsString, IsDate, IsOptional, IsEnum } from 'class-validator';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateSubscriptionDto {
  @IsString()
  subPackageId: string;

  @IsString()
  inAppPackageId: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
