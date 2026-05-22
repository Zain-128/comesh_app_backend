import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true })
export class Category {
  @Prop()
  icon: string;

  @Prop({})
  name: string;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
