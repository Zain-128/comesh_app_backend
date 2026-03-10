import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { SocialAuthService } from './social-auth.service';
import { CreateSocialAuthDto } from './dto/create-social-auth.dto';
import { UpdateSocialAuthDto } from './dto/update-social-auth.dto';

@Controller('socialAuth')
export class SocialAuthController {
  constructor(private readonly socialAuthService: SocialAuthService) {}

  @Post()
  create(@Body() createSocialAuthDto: CreateSocialAuthDto) {
    return this.socialAuthService.create(createSocialAuthDto);
  }

  @Get()
  findAll() {
    return this.socialAuthService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // return this.socialAuthService.findOne(+id);
    return 'asfdda';
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSocialAuthDto: UpdateSocialAuthDto,
  ) {
    return this.socialAuthService.update(+id, updateSocialAuthDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.socialAuthService.remove(+id);
  }
}
