import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, Types } from 'mongoose';
import { User } from 'src/users/user.schema';

export type ReportUserDocument = HydratedDocument<ReportUser>;

@Schema({ timestamps: true })
export class ReportUser {
  @Prop({ ref: () => User })
  userId: Types.ObjectId; // the user which is reporting to other user

  @Prop({ ref: () => User })
  reportOf: Types.ObjectId; // the user whom is reported

  @Prop({})
  reason: string;
}

export const ReportUserSchema = SchemaFactory.createForClass(ReportUser);
