import { Injectable } from '@nestjs/common';
import { CreateStaticContentDto } from './dto/create-static-content.dto';
import { UpdateStaticContentDto } from './dto/update-static-content.dto';
import { InjectModel } from '@nestjs/mongoose';
import { StaticContentDocument } from './static-content.schema';
import { Model } from 'mongoose';

@Injectable()
export class StaticContentService {
  constructor(
    @InjectModel('StaticContent')
    private readonly contentModel: Model<StaticContentDocument>,
  ) {}

  async create(createStaticContentDto: any) {
    await this.contentModel.create(createStaticContentDto);
    return {
      success: true,
      message: 'Created static content',
      data: null,
    };
  }

  findAll() {
    return `This action returns all staticContent`;
  }

  async findOne(type: string) {
    const data = await this.contentModel.findOne({ type });

    return {
      success: true,
      message: 'Static content fetched successfully',
      data: data,
    };
  }

  async update(id: string, updateStaticContentDto: UpdateStaticContentDto) {
    let data = await this.contentModel.findOneAndUpdate(
      { _id: id },
      {
        ...updateStaticContentDto,
      },
    );

    return {
      success: true,
      message: 'Static content updated successfully',
      data: data,
    };
  }

  remove(id: number) {
    return `This action removes a #${id} staticContent`;
  }
}
