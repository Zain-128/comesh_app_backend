import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateContactDto } from './dto/create-contact.dto';
import { ContactDocument, ContactSchemaName } from './contact.schema';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactSchemaName)
    private readonly contactModel: Model<ContactDocument>,
  ) {}

  async create(dto: CreateContactDto) {
    const doc = await this.contactModel.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      subject: dto.subject?.trim() ?? '',
      message: dto.message.trim(),
    });
    return {
      success: true,
      message: 'Your message has been received.',
      data: { id: doc._id },
    };
  }
}
