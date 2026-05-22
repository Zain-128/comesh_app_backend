import { Injectable } from '@nestjs/common';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  packagesSchemaName,
  PackagesDocument,
} from 'src/packages/packages.schema';

@Injectable()
export class PackagesService {
  constructor(
    @InjectModel(packagesSchemaName)
    private readonly packageModel: Model<PackagesDocument>,
  ) {}

  async create(createPackageDto: CreatePackageDto) {
    let Package = await this.packageModel.create(createPackageDto);

    return {
      success: true,
      message: 'Package created successfully',
      data: Package,
    };
  }

  async findAll() {
    let Packages = await this.packageModel.find({});

    return {
      success: true,
      message: 'Packages fetched successfully',
      data: Packages,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} package`;
  }

  update(id: number, updatePackageDto: UpdatePackageDto) {
    return `This action updates a #${id} package`;
  }

  remove(id: number) {
    return `This action removes a #${id} package`;
  }
}
