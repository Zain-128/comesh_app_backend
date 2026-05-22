import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  icon?: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
