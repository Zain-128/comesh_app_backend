import {
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

enum typeEnum {
  PLUS = 'PLUS',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

class SubPackageDto {
  @IsString()
  durationTitle: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsString()
  type?: typeEnum;

  @IsOptional()
  @IsNumber()
  durationInMonth?: string;

  @IsString()
  inAppPackageId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreatePackageDto {
  @IsString()
  mainTitle: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true }) // Each feature in the array should be a string
  features?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SubPackageDto)
  subPackages?: SubPackageDto;
}
