import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

@Schema()
export class Role {
  @Prop()
  name: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  status: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
