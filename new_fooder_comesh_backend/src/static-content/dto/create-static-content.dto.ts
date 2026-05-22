import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StaticContentTypeEnum, StatusEnum } from '../enums';

export class CreateStaticContentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(StaticContentTypeEnum)
  type: StaticContentTypeEnum;

  @IsOptional()
  @IsEnum(StatusEnum)
  status: string;
}
