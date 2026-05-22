import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminLoginDTO {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  role: string;
}
