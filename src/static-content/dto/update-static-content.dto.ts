import { PartialType } from '@nestjs/mapped-types';
import { CreateStaticContentDto } from './create-static-content.dto';

export class UpdateStaticContentDto extends PartialType(
  CreateStaticContentDto,
) {}
