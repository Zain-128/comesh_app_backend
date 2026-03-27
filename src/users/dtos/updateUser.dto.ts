import { Type } from 'class-transformer';
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
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LocationDTO)
  location?: LocationDTO;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  niche?: [string];

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
  @IsBoolean()
  @IsNotEmpty()
  willingToTravel?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  followers?: string;

  @IsOptional()
  @ValidateNested({ each: true })
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
  @IsBoolean()
  showLocation?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuestionAndAnswerDTO)
  questionAndAnswers?: QuestionAndAnswerDTO;

  @IsOptional()
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
}
