import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

export let SubscriptionSchemaName = 'Subscription';

@Schema({ timestamps: true })
export class Subscription {
  @Prop()
  userId: string;

  @Prop()
  subPackageId: string;

  @Prop()
  inAppPackageId: string;

  @Prop()
  startDate: string;

  @Prop()
  type: string; // yearly/half yearly/monthly

  @Prop()
  endDate: string;

  @Prop()
  status: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
