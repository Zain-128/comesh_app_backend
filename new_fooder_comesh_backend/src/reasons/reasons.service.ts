import { Inject, Injectable } from '@nestjs/common';
import { CreateReasonDto } from './dto/create-reason.dto';
import { UpdateReasonDto } from './dto/update-reason.dto';
import { ReasonDocument, reasonSchemaName } from './reason.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class ReasonsService {
  constructor(
    @InjectModel(reasonSchemaName)
    private readonly ReasonModel: Model<ReasonDocument>,
  ) {}

  async create(createReasonDto: CreateReasonDto) {
    let reason = await this.ReasonModel.create(createReasonDto);

    return {
      success: true,
      message: 'Reason created successfully',
      data: reason,
    };
  }

  async findAll({ type }) {
    let reason = await this.ReasonModel.find({ type });

    return {
      success: true,
      message: 'Reason fetched successfully',
      data: reason,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} reason`;
  }

  update(id: number, updateReasonDto: UpdateReasonDto) {
    return `This action updates a #${id} reason`;
  }

  remove(id: number) {
    return `This action removes a #${id} reason`;
  }
}
