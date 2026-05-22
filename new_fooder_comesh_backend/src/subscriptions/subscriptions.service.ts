import { Injectable } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { InjectModel } from '@nestjs/mongoose';
import {
  SubscriptionDocument,
  SubscriptionSchema,
  SubscriptionSchemaName,
} from './subscriptions.schema';
import { Model } from 'mongoose';
import { IGetUserAuthInfoRequest } from 'src/interfaces';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(SubscriptionSchemaName)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async create(
    createSubscriptionDto: CreateSubscriptionDto,
    req: IGetUserAuthInfoRequest,
  ) {
    let payload = {
      userId: req.user._id,
      ...createSubscriptionDto,
    };
    let subscription = await this.subscriptionModel.create(payload);
    if (subscription) {
    }

    return {
      success: true,
      message: 'You have been subscribed successfully',
      data: subscription,
    };
  }

  findAll() {
    return `This action returns all subscriptions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} subscription`;
  }

  update(id: number, updateSubscriptionDto: UpdateSubscriptionDto) {
    return `This action updates a #${id} subscription`;
  }

  remove(id: number) {
    return `This action removes a #${id} subscription`;
  }
}
