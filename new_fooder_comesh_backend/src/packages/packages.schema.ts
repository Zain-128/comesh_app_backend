import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PackagesDocument = HydratedDocument<Packages>;

export let packagesSchemaName = 'Packages';

@Schema()
class SubPackage {
  @Prop({ required: true })
  durationTitle: string;

  @Prop()
  description: string;

  @Prop()
  price: number;

  @Prop()
  type: string; // Plus / Gold / Platinum

  @Prop()
  durationInMonth: number;

  @Prop()
  inAppPackageId: string;

  @Prop()
  status: string;
}

const SubPackageSchema = SchemaFactory.createForClass(SubPackage);

@Schema({ timestamps: true })
export class Packages {
  @Prop()
  mainTitle: string;

  @Prop()
  description: string;

  @Prop()
  status: string;

  @Prop()
  features: string[];

  @Prop({ type: [SubPackageSchema] }) // Embed SubPackage schema
  subPackages: SubPackage[];
}

export const PackagesSchema = SchemaFactory.createForClass(Packages);
