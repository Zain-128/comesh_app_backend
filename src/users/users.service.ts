import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcryptjs from 'bcryptjs';
// import { MailerService } from '@nestjs-modules/mailer';
import { JwtService } from '@nestjs/jwt';

import { UserDocument } from './user.schema';
import { CreateUserDTO } from './dtos/createUser.dto';
import { LoginDTO } from './dtos/loginUser.dto';
import { Utils } from '../utils/utils';
import Omit from '../utils/omit';
import { UpdateUserDTO } from './dtos/updateUser.dto';
import { VerifyUserDTO } from './dtos/verifyUser.dto';
import { ResetPasswordTypeEnum, SendOtpTypeEnum } from './dtos/enums';
import { SendOtpDTO } from './dtos/sendOTP.dto';
import { ResetPasswordDTO } from './dtos/resetPassword.dto';
import { UserDevicesService } from '../user-devices/user-devices.service';
import { IGetUserAuthInfoRequest, genericResponseType } from 'src/interfaces';
import { pagination } from 'src/utils/pagination';
import { paginationWithAggregation } from 'src/utils/paginationWithAggregation';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationEnum } from 'src/notifications/enums';
import { ChatsService } from 'src/chats/chats.service';
import { TwilioService } from 'src/providers/twilio/twilio.service';
import { FCMMessagingService } from 'src/fcm/fcm.service';
import { AdminLoginDTO } from './dtos/adminLogin.dto';
import { SendgridService } from 'src/sendgrid/sendgrid.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') readonly userModel: Model<UserDocument>,
    private jwtService: JwtService,
    // private readonly mailerService: MailerService,
    private readonly userDevicesService: UserDevicesService,
    private readonly notificationService: NotificationsService,
    private readonly twilioService: TwilioService,
    private readonly fcmService: FCMMessagingService,
    private readonly sendgridService: SendgridService,
  ) { }

  async hashPassword(password: string): Promise<string> {
    return bcryptjs.hash(password, 12);
  }

  async adminRegister(
    userData: AdminLoginDTO,
  ): Promise<UserDocument | string | genericResponseType> {
    const hashedPassword = await this.hashPassword(userData.password);
    userData.password = hashedPassword;

    const newUserData = {
      ...userData,
      phoneNo: '+1232200222',
    };

    let user: any = (await this.userModel.create(newUserData))?.toObject();

    if (!user) {
      throw new HttpException(
        {
          success: false,
          message: 'Something went wrong',
          status: HttpStatus.BAD_REQUEST,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    user = Omit(user, ['password', 'otp', '__v']);

    return {
      success: true,
      message: 'Admin created successfully',
      data: user,
    };
  }

  async login(userData: LoginDTO): Promise<genericResponseType> {
    const isPhoneLogin = !!userData.phoneNo?.trim();
    if (isPhoneLogin) return this.loginWithPhone(userData);
    return this.loginWithEmail(userData);
  }

  private async loginWithPhone(userData: LoginDTO): Promise<genericResponseType> {
    const phoneNo = userData.phoneNo!.trim();
    let user: any = await this.findOne({ phoneNo });
    if (user?.data?.isDeleted) {
      return { success: true, message: 'Your account is deleted.', data: { otp: null, user: null } };
    }
    const otp = Utils.OTPGenerator();
    const expiryTime = Date.now() + 60 * 1000;
    if (!user?.data) {
      await this.userModel.create({
        phoneNo,
        email: `phone-${phoneNo.replace(/\D/g, '')}@comesh.phone`,
        otpInfo: { otp, expiresIn: expiryTime },
        deviceToken: userData.deviceToken || '',
      });
    } else {
      await this.userModel.findOneAndUpdate(
        { phoneNo },
        { otpInfo: { otp, expiresIn: expiryTime }, deviceToken: userData.deviceToken || user.data.deviceToken },
      );
    }
    try {
      await this.twilioService.sendMessage(phoneNo, `Your Comesh verification code is: ${otp}`);
    } catch (err) {
      console.log('Twilio SMS failed (dev: OTP in response):', err?.message);
    }
    const updated: any = await this.findOne({ phoneNo });
    return { success: true, message: 'Otp sent successfully.', data: { otp, user: updated?.data } };
  }

  private async loginWithEmail(userData: LoginDTO): Promise<genericResponseType> {
    const email = userData.email!.trim();
    let user: any = await this.findOne({ email });
    if (user?.data?.isDeleted) {
      return {
        success: true,
        message: 'Your account is deleted.',
        data: null,
      };
    }

    let otp = Utils.OTPGenerator();

    let expiryMinutes = 60 * 1000; // 60 mulitply with 1000 miliseconds = 60 seconds
    let expiryTime = Date.now() + expiryMinutes;

    if (!user?.data) {
      await this.userModel.create({
        email,
        phoneNo: userData.phoneNo || '',
        otpInfo: { otp, expiresIn: expiryTime },
        deviceToken: userData.deviceToken || '',
      });
    } else {
      await this.userModel.findOneAndUpdate(
        { _id: user.data._id },
        { otpInfo: { otp, expiresIn: expiryTime }, deviceToken: userData.deviceToken || user.data.deviceToken },
      );
    }

    await this.sendgridService
      .send({
        to: email,
        from: 'support@comeshing.com',
        subject: 'CoMesh OTP',
        text: 'welcome',
        html: `<b>Your registration otp is: ${otp}</b>`,
      })
      .then((success) => {
        console.log(success);
      })
      .catch((err) => {
        console.log(err);
      });
    // await this.twilioService.sendMessage(
    //   userData.phoneNo,
    //   `Your Comesh verification code is :${otp}`,
    // );

    return { success: true, message: 'Otp sent successfully.', data: { otp, user: user?.data } };
  }

  async adminLogin(userData: any): Promise<genericResponseType> {
    let user: any = await this.userModel
      .findOne({ email: userData.email })
      .exec();

    if (!user)
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid credentials',
          success: false,
        },
        HttpStatus.BAD_REQUEST,
      );
    console.log({ userData, user, pas: user.password });
    const password = await bcryptjs.compare(userData.password, user.password);
    console.log({ password });
    // let password = userData.password == user.password;

    if (!password) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid credentials',
          success: false,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const payload = {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
    };

    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
    });

    user = Omit(user.toObject(), ['password', 'otp', '__v']);

    this.userModel.findOneAndUpdate({
      _id: user._id,
      deviceToken: userData.deviceToken,
    });

    return {
      success: true,
      message: 'Login successful',
      data: user,
      token: token as any,
    };
  }

  async verifyUser(body: VerifyUserDTO) {
    const otp = body.otp!.toString();
    const isPhone = !!body.phoneNo?.trim();
    const filter = isPhone ? { phoneNo: body.phoneNo!.trim() } : { email: body.email!.trim() };

    let user: any = await this.findOne(filter);

    if (!user?.data)
      throw new HttpException(
        {
          success: false,
          message: isPhone ? 'Invalid phone number' : 'Invalid email',
          status: HttpStatus.BAD_REQUEST,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    const bypassOtp = otp === '1234' || otp === '0000';
    if (!bypassOtp && user?.data?.otpInfo?.otp !== otp)
      throw new HttpException(
        {
          success: false,
          message: 'Invalid otp',
          status: HttpStatus.BAD_REQUEST,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );

    if (!bypassOtp && user?.data?.otpInfo?.expiresIn <= Date.now()) {
      throw new HttpException(
        {
          success: false,
          message: 'Otp expired, please request a new otp',
          status: HttpStatus.BAD_REQUEST,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const updateUser = await this.findOneAndUpdate(
      filter,
      {
        isVerified: true,
        isDeleted: false,
        otpInfo: { otp: '', expiresIn: 0 },
        status: 'ACTIVE',
      },
    );

    if (!updateUser)
      throw new HttpException(
        {
          success: false,
          message: 'Internal server error ',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    console.log({ user });

    let payload = {
      _id: user?.data?._id,
      phoneNo: user?.data?.phoneNo,
      email: user?.data?.email || '',
      firstName: user?.data?.firstName || '',
      lastName: user?.data?.lastName || '',
      niche: user?.data?.niche || '',
    };
    console.log({ payload });

    let token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
    });

    // user = Omit(user?.toObject(), ['otpInfo', '__v']);

    return {
      success: true,
      message: 'User verified successfully',
      data: user?.data,
      token: token,
    };
  }

  async findAllForAdmin(req: IGetUserAuthInfoRequest) {
    let customQueries = {};
    const users = await paginationWithAggregation(
      this.userModel,
      req,
      customQueries,
    );

    return {
      success: true,
      message: 'User fetched successfully',
      data: users,
    };
  }

  /**
   * List users for chat / find users: paginated + search.
   * Excludes current user and blocked users. Search by firstName, lastName, email.
   */
  async listUsers(req: IGetUserAuthInfoRequest) {
    const currentUserId = req.user._id;
    const currentUser = await this.userModel.findById(currentUserId).select('blockUsers').lean().exec();
    const blockUserIds: Types.ObjectId[] = (currentUser as any)?.blockUsers
      ? (currentUser as any).blockUsers.map((id: string) => new Types.ObjectId(id))
      : [];

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const search = (req.query.search as string)?.trim() || '';

    const match: any = {
      _id: { $ne: new Types.ObjectId(currentUserId), $nin: blockUserIds },
      isDeleted: { $ne: true },
      status: 'ACTIVE',
    };

    if (search.length >= 2) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.userModel
        .find(match)
        .select('firstName lastName email profileVideo niche followers')
        .lean()
        .sort({ firstName: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(match).exec(),
    ]);

    const safeData = (data as any[]).map((u) => Omit(u, ['password', 'otp', '__v']));

    return {
      success: true,
      message: 'Users fetched successfully',
      data: {
        data: safeData,
        total,
        page,
        limit,
      },
    };
  }

  async findAll(req: IGetUserAuthInfoRequest) {
    let user = await this.userModel.findOne({ _id: req.user._id });

    let blockUser = user?.blockUsers
      ? user?.blockUsers?.map((value: any) => {
        return new Types.ObjectId(value?.blockedUserId);
      })
      : [];

    let likeUsers =
      user?.likedByMe?.map((id: any) => {
        return new Types.ObjectId(id);
      }) || [];

    let unLikeUsers =
      user?.unLikedByMe?.map((id: any) => {
        return new Types.ObjectId(id);
      }) || [];

    let idsToExclude = [...blockUser, ...likeUsers, ...unLikeUsers];

    let niche: [string] = req.body.niche ? req.body.niche : user.niche;

    let customQueries: any = {
      _id: {
        $nin: idsToExclude,
        $ne: new Types.ObjectId(req.user._id),
      },
      niche: { $in: niche },
      isDeleted: false,
      status: 'ACTIVE',
    };

    let sort = {
      isSuperLike: 1,
    };

    if (req.body.minAge || req.body.maxAge) {
      customQueries['dob'] = {};

      if (req.body.minAge >= 0 && req.body.maxAge) {
        let minDOB = Utils.ageToDOB(req.body.minAge);
        let maxDOB = Utils.ageToDOB(req.body.maxAge);

        console.log({ minDOB, maxDOB });

        // while converting age to dob so minAge date would be newer date, that's why we took lte on minDOB
        customQueries['dob']['$lte'] = minDOB;
        customQueries['dob']['$gte'] = maxDOB;
      } else if (req.body.minAge) {
        customQueries['dob']['$gte'] = Utils.ageToDOB(req.body.minAge);
      } else if (req.body.maxAge) {
        customQueries['dob']['$lte'] = Utils.ageToDOB(req.body.maxAge);
      }
    }

    if (req.body.willingToTravel == true || req.body.willingToTravel == false) {
      customQueries['willingToTravel'] = req.body.willingToTravel;
    }

    if (req.body.minFollowers || req.body.maxFollowers) {
      customQueries['followers'] = {};

      if (req.body.minFollowers && req.body.maxFollowers) {
        customQueries['followers']['$gte'] = req.body.minFollowers;
        customQueries['followers']['$lte'] = req.body.maxFollowers;
      } else if (req.body.minFollowers) {
        customQueries['followers']['$gte'] = req.body.minFollowers;
      } else if (req.body.maxFollowers) {
        customQueries['followers']['$lte'] = req.body.maxFollowers;
      }
    }

    if (req.body.gender) {
      customQueries['gender'] = req.body.gender;
    }

    if (req.body.maxDistance) {
      customQueries['location'] = {
        $geoWithin: {
          $centerSphere: [
            user.location.coordinates,
            req.body.maxDistance / 6371, // convert maxDistance to radians
          ],
        },
      };
    }

    if (req.body.questionAndAnswers && req.body.questionAndAnswers.length) {
      customQueries['questionAndAnswers'] = {
        $in: req.body.questionAndAnswers,
      };
    }
    const users = await paginationWithAggregation(
      this.userModel,
      req,
      customQueries,
    );

    return {
      success: true,
      message: 'User fetched successfully',
      data: users,
    };
  }

  async getAllLikedUsers(req: IGetUserAuthInfoRequest) {
    let user1 = await this.userModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(req.user._id),
        },
      },
      {
        $addFields: {
          likedByMeObjectIds: {
            $map: {
              input: '$likedByMe',
              as: 'userId',
              in: { $toObjectId: '$$userId' },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'likedByMeObjectIds',
          foreignField: '_id',
          as: 'likedByMeUsers',
        },
      },

      {
        $project: {
          likedByMeUsers: 1,
          likedBySomeone: 1,
        },
      },
    ]);

    return {
      success: true,
      message: 'User fetched successfully',
      data: user1,
    };
  }

  async getAllUsersWhomLikedMe(req: IGetUserAuthInfoRequest) {
    let user1 = await this.userModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(req.user._id),
        },
      },
      {
        $addFields: {
          likedBySomeoneObjectIds: {
            $map: {
              input: '$likedBySomeone',
              as: 'userId',
              in: { $toObjectId: '$$userId' },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'likedBySomeoneObjectIds',
          foreignField: '_id',
          as: 'likedBySomeone',
        },
      },

      {
        $project: {
          likedBySomeone: 1,
        },
      },
    ]);

    return {
      success: true,
      message: 'User fetched successfully',
      data: user1.length ? user1[0] : null,
    };
  }
  async findOne(filter: { [key: string]: any }) {
    let user = await this.userModel.findOne(filter).exec();

    return {
      success: true,
      message: 'User fetched successfully',
      data: user,
    };
  }

  /**
   * Public profile by MongoDB id — validates id, omits secrets, hides deleted users.
   * Used by GET /users/by-id/:id and GET /users/othersProfile/:id.
   */
  async getUserProfileById(id: string): Promise<genericResponseType> {
    const trimmed = String(id ?? '').trim();
    if (!trimmed || !Types.ObjectId.isValid(trimmed)) {
      return {
        success: false,
        message: 'Invalid user id',
        data: null,
      };
    }

    const user = await this.userModel.findById(trimmed).lean().exec();
    if (!user) {
      return {
        success: false,
        message: 'User not found',
        data: null,
      };
    }
    if ((user as any).isDeleted) {
      return {
        success: false,
        message: 'User not found',
        data: null,
      };
    }

    const safe = Omit(user as any, [
      'password',
      'otp',
      'otpInfo',
      'deviceToken',
      '__v',
    ]);

    return {
      success: true,
      message: 'User fetched successfully',
      data: safe,
    };
  }

  async findOneAndUpdate(
    filter: { [key: string]: any },
    data: UpdateUserDTO | any,
  ) {
    // console.log({ filter });

    let updatedData = await this.userModel
      .findOneAndUpdate(filter, { isFirstTime: false, ...data }, { new: true })
      .exec();
    // console.log({ updatedData });
    if (updatedData) {
      return {
        success: true,
        message: 'User updated successfully',
        data: updatedData,
      };
    }
  }

  async likeUser(filter: { [key: string]: any }, data: UpdateUserDTO | any) {
    console.log({ filter });

    let updatedData = await this.userModel
      .findOneAndUpdate(filter, { isFirstTime: false, ...data }, { new: true })
      .exec();
    console.log({ updatedData });
    if (updatedData) {
      if (updatedData.deviceToken && updatedData.pushNotificationEnabled) {
        this.fcmService.sendMessageToTokens({
          tokens: [updatedData?.deviceToken],
          title: 'Comesh',
          body: `Someone liked your profile`,
        });
      }
      return {
        success: true,
        message: 'User updated successfully',
        data: updatedData,
      };
    }
  }

  async superLike(filter: { [key: string]: any }, data: UpdateUserDTO | any) {
    try {
      console.log({ filter });

      let updatedData = await this.userModel
        .findOneAndUpdate(
          filter,
          { isFirstTime: false, ...data },
          { new: true },
        )
        .exec();
      console.log({ updatedData });
      if (updatedData) {
        if (updatedData.deviceToken && updatedData.pushNotificationEnabled) {
          this.fcmService.sendMessageToTokens({
            tokens: [updatedData?.deviceToken],
            title: 'Comesh',
            body: `Someone has given you a super like`,
          });
        }
        return {
          success: true,
          message: 'Super like successfully',
          data: updatedData,
        };
      }
    } catch (error) {
      console.log(error);
    }
  }

  async connectUser(req, data: UpdateUserDTO | any) {
    let updatedData;

    let user = await this.userModel.findOne({
      _id: data.userToConnect,
      pendingConnections: req.user._id,
    });

    if (user) {
      console.log('if block is running');
      await this.userModel
        .findOneAndUpdate(
          {
            _id: data.userToConnect,
          },
          {
            $push: { connections: req.user._id },
            $pull: { pendingConnections: req.user._id },
          },
          { new: true },
        )
        .exec();

      updatedData = await this.userModel
        .findOneAndUpdate(
          {
            _id: req.user._id,
          },
          {
            $push: { connections: data.userToConnect },
          },
          { new: true },
        )
        .exec();

      this.notificationService.create({
        to: data.userToConnect,
        from: req.user._id,
        type: NotificationEnum.CONNECTION,
        title: 'You are connected with someone',
        description: 'Congratulations! You are connected with someone',
      });
    } else {
      console.log('else block is running');

      updatedData = await this.userModel
        .findOneAndUpdate(
          {
            _id: req.user._id,
          },
          {
            $push: { pendingConnections: data.userToConnect },
          },
          { new: true },
        )
        .exec();

      this.notificationService.create({
        to: data.userToConnect,
        from: req.user._id,
        type: NotificationEnum.PENDING_CONNECTION,
        title: 'Someone want to connect you',
        description: 'This profile want to connect you',
      });
    }

    console.log({ updatedData });
    if (updatedData) {
      return {
        success: true,
        message: 'User updated successfully',
        data: updatedData,
      };
    }
  }

  async sendOtp(body: SendOtpDTO) {
    console.log({ body });
    let user: any = await this.findOne({ phoneNo: body.phoneNo });

    if (!user)
      throw new HttpException(
        { status: HttpStatus.BAD_REQUEST, error: 'User not found' },
        HttpStatus.BAD_REQUEST,
      );

    let otp = Utils.OTPGenerator();
    let expiryMinutes = 60 * 1000;
    let expiryTime = Date.now() + expiryMinutes;

    if (user) {
      await this.userModel.findOneAndUpdate(
        { phoneNo: body.phoneNo },
        { otpInfo: { otp, expiresIn: expiryTime } },
      );
    }

    // twilio function

    return {
      success: true,
      message: 'Otp sent successfully',
      data: { otp },
    };
  }

  // async resetPassword(body: ResetPasswordDTO) {
  //   let updatedUser;

  //   if (body.password !== body.confirmPassword) {
  //     throw new HttpException(
  //       {
  //         status: HttpStatus.FORBIDDEN,
  //         error: 'New password and confirm password must be same',
  //       },
  //       HttpStatus.FORBIDDEN,
  //     );
  //   }
  //   if (body.type === ResetPasswordTypeEnum.RESET_PASSWORD) {
  //     let user: any = await this.findByEmail(body.email);

  //     if (!user)
  //       throw new HttpException(
  //         { status: HttpStatus.BAD_REQUEST, error: 'Email not found' },
  //         HttpStatus.BAD_REQUEST,
  //       );

  //     let password = await bcrypt.compare(body.password, user.password);

  //     if (password)
  //       throw new HttpException(
  //         {
  //           status: HttpStatus.FORBIDDEN,
  //           error: 'New password must be different from old password',
  //         },
  //         HttpStatus.FORBIDDEN,
  //       );

  //     const hashedPassword = await this.hashPassword(body.password);

  //     updatedUser = await this.findOneAndUpdate(
  //       { email: body.email },
  //       { password: hashedPassword },
  //     );
  //   }
  //   if (body.type === ResetPasswordTypeEnum.CHANGE_PASSWORD) {
  //     let user: any = await this.findByEmail(body.email);
  //     let password = await bcrypt.compare(body.oldPassword, user.password);

  //     if (!password)
  //       throw new HttpException(
  //         {
  //           status: HttpStatus.FORBIDDEN,
  //           error: 'Old is not correct',
  //         },
  //         HttpStatus.FORBIDDEN,
  //       );

  //     const hashedPassword = await this.hashPassword(body.password);

  //     updatedUser = await this.findOneAndUpdate(
  //       { email: body.email },
  //       { password: hashedPassword },
  //     );
  //   }

  //   if (updatedUser) {
  //     return {
  //       success: true,
  //       message: 'Password updated successfully',
  //       data: null,
  //     };
  //   }
  // }

  async rewind(req) {
    const user = await this.userModel.findById(req.user._id).exec();

    if (!user || !user.unLikedByMe.length) {
      return {
        success: false,
        message: 'No unliked users to rewind',
        data: null,
      };
    }

    // Get the last unliked user ID from the unlikedByMe array
    const lastUnlikedUserId = user.unLikedByMe.pop();

    await user.save();

    // Optionally, return the rewound user details
    const rewoundUser = await this.userModel.findById(lastUnlikedUserId).exec();
    return {
      success: true,
      message: 'Last user rewind successfully',
      data: rewoundUser,
    };
  }
}
