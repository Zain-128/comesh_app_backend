import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { ContactSchema, ContactSchemaName } from './contact.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactSchemaName, schema: ContactSchema },
    ]),
  ],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
