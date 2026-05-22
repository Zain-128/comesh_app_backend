import { Module } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { PackagesSchema, packagesSchemaName } from './packages.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: packagesSchemaName, schema: PackagesSchema },
    ]),
  ],
  controllers: [PackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}
