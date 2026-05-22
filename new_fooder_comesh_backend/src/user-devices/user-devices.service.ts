import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CreateUserDeviceDto } from './dto/create-user-device.dto';
import { UpdateUserDeviceDto } from './dto/update-user-device.dto';
import { UserDevice, UserDeviceDocument } from './user-device.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class UserDevicesService {
  constructor(
    @InjectModel('UserDevice')
    private readonly UserDeviceModel: Model<UserDeviceDocument>,
  ) { }

  async create(createUserDeviceDto: CreateUserDeviceDto) {
    const { deviceType, deviceToken, userId } = createUserDeviceDto;

    const userDevice = {
      userId,
      deviceType,
      deviceToken,
    };

    const exists = await this.UserDeviceModel.findOne({
      deviceType,
      deviceToken,
      userId,
    });

    if (exists)
      return {
        success: true,
        message: 'Device token already exists',
        data: exists,
      };

    const tokenAdded = await this.UserDeviceModel.create(userDevice);

    if (!tokenAdded)
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid object id',
          success: false,
        },
        HttpStatus.BAD_REQUEST,
      );

    return {
      success: true,
      message: 'Device token added successfully',
      data: tokenAdded,
    };
  }

  async getTokensByUserId(userId: string): Promise<string[]> {
    const devices = await this.UserDeviceModel.find({
      userId,
      status: 'ACTIVE',
      isDeleted: false,
    });
    return devices.map((device) => device.deviceToken);
  }

  findAll() {
    return `This action returns all userDevices`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userDevice`;
  }

  update(id: number, updateUserDeviceDto: UpdateUserDeviceDto) {
    return `This action updates a #${id} userDevice`;
  }

  remove(id: number) {
    return `This action removes a #${id} userDevice`;
  }
}
