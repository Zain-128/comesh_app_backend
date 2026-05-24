import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDate,
  IsObject,
  ValidateNested,
  IsBoolean,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

/** Multipart / URL-encoded bodies send booleans as the strings "true" | "false". */
function formBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return value;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Multipart fields often arrive as JSON strings (e.g. questionAndAnswers, niche). */
function formJson(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return value;
    if (t.startsWith('[') || t.startsWith('{')) {
      try {
        return JSON.parse(t);
      } catch {
        return value;
      }
    }
  }
  return value;
}

class OtpInfoDTO {
  @IsString()
  otp: string;

  @IsDate()
  expiresIn: number;
}

class LocationDTO {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  coordinates: [string];

  @IsString()
  type: 'Point';
}

class SocialMediaProfilesDTO {
  @IsString()
  facebook: string;

  @IsString()
  instagram: string;

  @IsString()
  twitter: string;

  @IsString()
  youtube: string;

  @IsString()
  tiktok: string;
}

class QuestionAndAnswerDTO {
  @IsString()
  question: string;

  @IsString()
  answer: string;
}

export class UpdateUserDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsNotEmpty()
  profileVideo?: any;

  @IsOptional()
  @IsString()
  profileVideoThumbnail?: string;

  @IsOptional()
  @IsString()
  profileImage?: string;

  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dob?: string;

  @IsOptional()
  @Transform(({ value }) => formJson(value))
  @ValidateNested()
  @Type(() => LocationDTO)
  location?: LocationDTO;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Transform(({ value }) => formJson(value))
  @IsArray()
  @IsString({ each: true })
  niche?: string[];

  @IsOptional()
  @IsNotEmpty()
  videos?: any;

  @IsOptional()
  @IsNotEmpty()
  previousVideos?: any;

  @IsOptional()
  @IsNotEmpty()
  emptyVideos?: any;

  @IsOptional()
  @Transform(({ value }) => formBoolean(value))
  @IsBoolean()
  @IsNotEmpty()
  willingToTravel?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  followers?: string;

  @IsOptional()
  @Transform(({ value }) => formJson(value))
  @ValidateNested()
  @Type(() => SocialMediaProfilesDTO)
  socialMediaProfiles?: SocialMediaProfilesDTO;

  @IsOptional()
  @IsString()
  availability?: string;

  @IsOptional()
  @IsString()
  availabilityFrom?: string;

  @IsOptional()
  @IsString()
  availabilityTo?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => formBoolean(value))
  @IsBoolean()
  showLocation?: boolean;

  @IsOptional()
  @Transform(({ value }) => formJson(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionAndAnswerDTO)
  questionAndAnswers?: QuestionAndAnswerDTO[];

  @IsOptional()
  @Transform(({ value }) => formBoolean(value))
  @IsBoolean()
  @IsNotEmpty()
  isVerified?: boolean;

  @IsOptional()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OtpInfoDTO)
  otpInfo?: OtpInfoDTO;

  @IsOptional()
  @IsString()
  deviceToken?: string;

  @IsOptional()
  blockUsers?: any;

  @IsOptional()
  lastSeenChatTime?: string;

  @IsOptional()
  pronouns?: string;

  @IsOptional()
  @Transform(({ value }) => formBoolean(value))
  @IsBoolean()
  pushNotificationEnabled?: boolean;

  /** Set by server when profile videos are transcoding in background. */
  @IsOptional()
  @Transform(({ value }) => formBoolean(value))
  @IsBoolean()
  mediaProcessing?: boolean;
}
