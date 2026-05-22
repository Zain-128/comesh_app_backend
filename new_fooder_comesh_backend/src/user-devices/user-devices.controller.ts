import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserDevicesService } from './user-devices.service';
import { CreateUserDeviceDto } from './dto/create-user-device.dto';
import { UpdateUserDeviceDto } from './dto/update-user-device.dto';

@Controller('user-devices')
export class UserDevicesController {
  constructor(private readonly userDevicesService: UserDevicesService) {}

  @Post()
  create(@Body() createUserDeviceDto: CreateUserDeviceDto) {
    return this.userDevicesService.create(createUserDeviceDto);
  }

  @Get()
  findAll() {
    return this.userDevicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userDevicesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDeviceDto: UpdateUserDeviceDto) {
    return this.userDevicesService.update(+id, updateUserDeviceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userDevicesService.remove(+id);
  }
}
