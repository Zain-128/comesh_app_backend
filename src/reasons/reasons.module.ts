import { Module } from '@nestjs/common';
import { ReasonsService } from './reasons.service';
import { ReasonsController } from './reasons.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ReasonSchema, reasonSchemaName } from './reason.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: reasonSchemaName, schema: ReasonSchema },
    ]),
  ],
  controllers: [ReasonsController],
  providers: [ReasonsService],
})
export class ReasonsModule {}
