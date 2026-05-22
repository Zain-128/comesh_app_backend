import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReasonDocument = HydratedDocument<Reason>;

export let reasonSchemaName = 'Reason';

@Schema({ timestamps: true })
export class Reason {
  @Prop()
  reason: string;

  @Prop()
  type: string;

  @Prop()
  status: string;
}

export const ReasonSchema = SchemaFactory.createForClass(Reason);
