import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationDocument } from './notification.schema';
import { IGetUserAuthInfoRequest } from 'src/interfaces';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel('Notification')
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    let notif = await this.notificationModel.create(createNotificationDto);
    console.log({ createNotificationDto, notif });
    return {
      success: true,
      message: 'Notification created successfully',
      data: notif,
    };
  }

  async findAll(req: IGetUserAuthInfoRequest) {
    console.log(req.user._id);
    const notification = await this.notificationModel
      .find({
        to: req.user._id,
      })
      .sort({ createdAt: -1 });

    console.log({ notification });

    return {
      success: true,
      message: 'Notification fetched successfully',
      data: notification,
    };
  }

  findOne(id: number) {
    return 'find one';
  }

  async update(id: string, updateNotificationDto: UpdateNotificationDto) {
    await this.notificationModel.findOneAndUpdate(
      { _id: id },
      updateNotificationDto,
      { new: true },
    );

    return {
      success: true,
      message: 'Notification updated successfully',
      data: null,
    };
  }

  async remove(filter: { [key: string]: any }) {
    await this.notificationModel.findOneAndDelete(filter);

    return {
      success: true,
      message: 'Notification deleted successfully',
      data: null,
    };
  }
}
