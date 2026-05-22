export class RatingAndFeedback {}
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from 'src/users/user.schema';

export type RatingAndFeedBackDocument = HydratedDocument<RatingAndFeedBack>;
export const RatingAndFeedBackSchemaName = 'RatingAndFeedBack';

@Schema({ timestamps: true })
export class RatingAndFeedBack {
  @Prop({ ref: () => User })
  userId: Types.ObjectId;

  @Prop({ required: true })
  feedback: string;

  @Prop()
  rating: number;
}

export const RatingAndFeedBackSchema =
  SchemaFactory.createForClass(RatingAndFeedBack);
