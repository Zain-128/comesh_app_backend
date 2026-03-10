import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReportUserDto {
  @IsString()
  @IsNotEmpty()
  reportOf: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
