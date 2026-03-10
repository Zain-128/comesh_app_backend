import { Injectable } from '@nestjs/common';
import { CreateReportUserDto } from './dto/create-report-user.dto';
import { UpdateReportUserDto } from './dto/update-report-user.dto';
import { InjectModel } from '@nestjs/mongoose';

import { ReportUserDocument } from './report-user.schema';
import { Model } from 'mongoose';
import { paginationWithAggregation } from 'src/utils/paginationWithAggregation';
import { pagination } from 'src/utils/pagination';

@Injectable()
export class ReportUserService {
  constructor(
    @InjectModel('ReportUser')
    private readonly reportUserModel: Model<ReportUserDocument>,
  ) {}

  async create(createReportUserDto: any) {
    let reported = await this.reportUserModel.create(createReportUserDto);

    return {
      success: true,
      message: 'Report has been sent to admin',
      data: reported,
    };
  }

  async findAll(req) {
    let reports = await pagination(this.reportUserModel, req);

    return {
      success: true,
      message: 'Report has been sent to admin',
      data: reports,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} reportUser`;
  }

  update(id: number, updateReportUserDto: UpdateReportUserDto) {
    return `This action updates a #${id} reportUser`;
  }

  remove(id: number) {
    return `This action removes a #${id} reportUser`;
  }
}
