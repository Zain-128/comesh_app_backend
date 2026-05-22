import { Injectable } from '@nestjs/common';
import { CreateSocialAuthDto } from './dto/create-social-auth.dto';
import { UpdateSocialAuthDto } from './dto/update-social-auth.dto';
import { SocialAuthDocument } from './social-auth.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SocialAuthService {
  constructor(
    @InjectModel('SocialAuth')
    private readonly socialAuthModel: Model<SocialAuthDocument>,
    private jwtService: JwtService,
  ) {}

  async create(body: CreateSocialAuthDto) {
    let result = await this.findOne({
      clientId: body.clientId,
      platform: body.platform,
    });

    let message = 'User registered successfully';

    if (!result) {
      result = await this.socialAuthModel.create(body);
    }

    let payload = {
      fullName: result.fullName,
      email: result.email,
      platform: result.platform,
      clientId: result.clientId,
    };

    let token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
    });
    message = 'Login successful';

    return {
      success: true,
      message,
      data: result,
      token: token as string,
    };
  }

  async findAll() {
    return `This action returns all socialAuth`;
  }

  async findOne(filter: CreateSocialAuthDto) {
    return this.socialAuthModel.findOne(filter);
  }

  async update(id: number, updateSocialAuthDto: UpdateSocialAuthDto) {
    return `This action updates a #${id} socialAuth`;
  }

  async remove(id: number) {
    return `This action removes a #${id} socialAuth`;
  }
}
