import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StaticContentDocument = HydratedDocument<StaticContent>;

enum StaticContentTypeEnum {
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  TERMS_AND_CONDITIONS = 'TERMS_AND_CONDITIONS',
}

@Schema()
export class StaticContent {
  @Prop()
  title: string;

  @Prop({})
  description: string;

  @Prop({ enum: StaticContentTypeEnum })
  type: string;

  @Prop()
  status: string;
}

export const StaticContentSchema = SchemaFactory.createForClass(StaticContent);
