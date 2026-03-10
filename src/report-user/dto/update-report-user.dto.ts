import { PartialType } from '@nestjs/mapped-types';
import { CreateReportUserDto } from './create-report-user.dto';

export class UpdateReportUserDto extends PartialType(CreateReportUserDto) {}
