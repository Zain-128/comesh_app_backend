import { IsString, IsNotEmpty } from 'class-validator';
export class CreateReasonDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}
