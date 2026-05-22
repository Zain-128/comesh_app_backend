import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { AuthGuard } from 'src/guards/auth.guard';

@Controller('/packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() createPackageDto: CreatePackageDto) {
    return this.packagesService.create(createPackageDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll() {
    return this.packagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePackageDto: UpdatePackageDto) {
    return this.packagesService.update(+id, updatePackageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.packagesService.remove(+id);
  }
}
