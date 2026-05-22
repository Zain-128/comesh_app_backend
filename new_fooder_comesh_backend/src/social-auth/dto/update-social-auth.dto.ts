import { PartialType } from '@nestjs/mapped-types';
import { CreateSocialAuthDto } from './create-social-auth.dto';

export class UpdateSocialAuthDto extends PartialType(CreateSocialAuthDto) {}
