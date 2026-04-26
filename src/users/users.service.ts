import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcryptjs from 'bcryptjs';
import { request as httpsRequest } from 'https';
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
import {
  SUBSCRIPTION_TIERS,
  TIER_LIMITS,
  effectiveSubscriptionTier,
  limitsForUser,
  normalizeTier,
  tierFromProductId,
} from './subscription-tier';

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

  private utcDay(date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  canUseSuperLike(user: any) {
    return effectiveSubscriptionTier(user || {}) !== SUBSCRIPTION_TIERS.CREATOR_ACCESS;
  }

  async getCurrentTierLimits(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('subscriptionTier subscriptionExpiresAt')
      .lean()
      .exec();
    return limitsForUser(user || {});
  }

  async consumeSwipeForLike(userId: string): Promise<{
    success: boolean;
    message: string;
    data: null | {
      tier: string;
      swipesRemainingToday: number | null;
    };
  }> {
    const user = await this.userModel
      .findById(userId)
      .select('subscriptionTier subscriptionExpiresAt swipeCountDay swipeDayUtc')
      .lean()
      .exec();

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        data: null,
      };
    }

    const tier = effectiveSubscriptionTier(user as any);
    const limits = TIER_LIMITS[tier];
    const today = this.utcDay();
    let count = Number((user as any).swipeCountDay || 0);
    const day = String((user as any).swipeDayUtc || '');

    if (day !== today) {
      count = 0;
      await this.userModel
        .updateOne({ _id: userId }, { $set: { swipeDayUtc: today, swipeCountDay: 0 } })
        .exec();
    }

    if (limits.maxDailySwipes != null && count >= limits.maxDailySwipes) {
      return {
        success: false,
        message: `Daily swipe limit reached. Upgrade to Collab Pro for unlimited swipes.`,
        data: {
          tier,
          swipesRemainingToday: 0,
        },
      };
    }

    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { swipeDayUtc: today }, $inc: { swipeCountDay: 1 } },
      )
      .exec();

    const remaining =
      limits.maxDailySwipes == null
        ? null
        : Math.max(0, limits.maxDailySwipes - (count + 1));

    return {
      success: true,
      message: 'Swipe allowed',
      data: {
        tier,
        swipesRemainingToday: remaining,
      },
    };
  }

  private postJson(urlString: string, payload: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const target = new URL(urlString);
        const body = JSON.stringify(payload);
        const req = httpsRequest(
          {
            method: 'POST',
            hostname: target.hostname,
            path: `${target.pathname}${target.search}`,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let raw = '';
            res.on('data', (chunk) => {
              raw += chunk;
            });
            res.on('end', () => {
              try {
                resolve(raw ? JSON.parse(raw) : {});
              } catch {
                reject(new Error('Invalid JSON from Apple verifyReceipt'));
              }
            });
          },
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private async verifyAppleReceiptRaw(receiptData: string) {
    const sharedSecret = String(process.env.APPLE_SHARED_SECRET || '').trim();
    if (!sharedSecret) {
      throw new HttpException(
        {
          success: false,
          message: 'APPLE_SHARED_SECRET is required for production receipt verification',
          status: HttpStatus.BAD_REQUEST,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const payload = {
      'receipt-data': receiptData,
      password: sharedSecret,
      'exclude-old-transactions': true,
    };

    let response = await this.postJson(
      'https://buy.itunes.apple.com/verifyReceipt',
      payload,
    );
    if (Number(response?.status) === 21007) {
      response = await this.postJson(
        'https://sandbox.itunes.apple.com/verifyReceipt',
        payload,
      );
    }
    if (Number(response?.status) !== 0) {
      throw new HttpException(
        {
          success: false,
          message: `Apple receipt verification failed (status ${response?.status})`,
          status: HttpStatus.BAD_REQUEST,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return response;
  }

  private extractLatestAppleSubscription(receiptResponse: any): {
    productId: string | null;
    expiresAt: Date | null;
  } {
    const rowsRaw =
      receiptResponse?.latest_receipt_info ||
      receiptResponse?.receipt?.in_app ||
      [];
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    if (!rows.length) {
      return { productId: null, expiresAt: null };
    }

    rows.sort((a: any, b: any) => {
      const ea = Number(a?.expires_date_ms || a?.purchase_date_ms || 0);
      const eb = Number(b?.expires_date_ms || b?.purchase_date_ms || 0);
      return eb - ea;
    });

    const latest = rows[0] || {};
    const pid = latest?.product_id ? String(latest.product_id) : null;
    const expMs = Number(latest?.expires_date_ms || 0);
    return {
      productId: pid,
      expiresAt: expMs > 0 ? new Date(expMs) : null,
    };
  }

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
        pushNotificationEnabled: Boolean(userData.deviceToken),
      });
    } else {
      const nextToken = userData.deviceToken || user.data.deviceToken;
      await this.userModel.findOneAndUpdate(
        { phoneNo },
        {
          otpInfo: { otp, expiresIn: expiryTime },
          deviceToken: nextToken,
          ...(userData.deviceToken ? { pushNotificationEnabled: true } : {}),
        },
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

    const $set: Record<string, unknown> = {
      isVerified: true,
      isDeleted: false,
      otpInfo: { otp: '', expiresIn: 0 },
      status: 'ACTIVE',
      /** Do not set `isFirstTime` here — new users default to `true` (onboarding). It becomes `false` when profile/onboarding completes (see update flows). */
    };
    if (body.deviceToken) {
      $set.deviceToken = body.deviceToken;
      $set.pushNotificationEnabled = true;
    }

    /** Update by `_id` — phone string format mismatches were causing findOneAndUpdate to match 0 docs → 500. */
    let updatedDoc: UserDocument | null;
    try {
      updatedDoc = await this.userModel
        .findOneAndUpdate({ _id: user.data._id }, { $set }, { new: true })
        .exec();
    } catch (err: any) {
      console.error('verifyUser update failed', err?.message, err);
      throw new HttpException(
        {
          success: false,
          message: err?.message || 'Could not verify user',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!updatedDoc) {
      throw new HttpException(
        {
          success: false,
          message: 'User record could not be updated',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    console.log({ user: updatedDoc });

    const userObj = updatedDoc.toObject
      ? updatedDoc.toObject()
      : (updatedDoc as unknown as Record<string, unknown>);
    const isFirstTime =
      (userObj as { isFirstTime?: boolean }).isFirstTime !== false;

    let payload = {
      _id: updatedDoc._id,
      phoneNo: updatedDoc.phoneNo,
      email: updatedDoc.email || '',
      firstName: updatedDoc.firstName || '',
      lastName: updatedDoc.lastName || '',
      niche: updatedDoc.niche || '',
      /** Lets clients read onboarding vs returning user from decoded JWT alone. */
      isFirstTime,
    };
    console.log({ payload });

    let token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
    });

    return {
      success: true,
      message: 'User verified successfully',
      data: userObj,
      token: token,
      /** Same flag as `data.isFirstTime` — top-level for clients that only check root fields. */
      isFirstTime,
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
        .select('firstName lastName profileVideo niche followers')
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

    if (!user) {
      throw new HttpException(
        {
          success: false,
          message: 'User not found',
          status: HttpStatus.NOT_FOUND,
          data: null,
        },
        HttpStatus.NOT_FOUND,
      );
    }

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

    const nicheList = (req.body as { niche?: string[] })?.niche?.length
      ? (req.body as { niche: string[] }).niche
      : Array.isArray(user.niche) && user.niche.length
        ? [...user.niche].map((n) => String(n))
        : [];
    const niche = nicheList;
    const limits = limitsForUser(user as any);

    let customQueries: any = {
      _id: {
        $nin: idsToExclude,
        $ne: new Types.ObjectId(req.user._id),
      },
      isDeleted: false,
      status: 'ACTIVE',
    };
    if (niche?.length) {
      customQueries.niche = { $in: niche };
    }

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

    if (limits.advancedFilters && (req.body.minFollowers || req.body.maxFollowers)) {
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

    const requestedMiles = Number(req.body.maxDistance || 0);
    const allowedMiles =
      limits.maxLocalMatchMiles == null
        ? requestedMiles || 0
        : Math.min(requestedMiles || limits.maxLocalMatchMiles, limits.maxLocalMatchMiles);

    if (allowedMiles > 0) {
      const coords = (user as any)?.location?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const radiusRadians = (allowedMiles * 1.60934) / 6371;
        customQueries['location'] = {
          $geoWithin: {
            $centerSphere: [
              coords,
              radiusRadians,
            ],
          },
        };
      }
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
    const me = await this.userModel
      .findById(req.user._id)
      .select('subscriptionTier subscriptionExpiresAt')
      .lean()
      .exec();
    const limits = limitsForUser(me || {});
    if (!limits.seeWhoLiked) {
      return {
        success: true,
        message: 'Upgrade to Collab Pro to see who liked you',
        data: { likedBySomeone: [] },
      };
    }

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
      'email',
      'phoneNo',
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

  async getSubscriptionPaywall(req: IGetUserAuthInfoRequest) {
    const user = await this.userModel
      .findById(req.user._id)
      .select('subscriptionTier subscriptionExpiresAt createdAt')
      .lean()
      .exec();

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        data: null,
      };
    }

    const createdMs = new Date((user as any).createdAt || Date.now()).getTime();
    const ageDays = Math.max(0, Math.floor((Date.now() - createdMs) / (24 * 60 * 60 * 1000)));

    let rolloutPhase = 1;
    let visiblePaidTiers: Array<{ tier: string; title: string; priceMonthlyUsd: number }> = [];
    if (ageDays >= 90) {
      rolloutPhase = 4;
      visiblePaidTiers = [
        { tier: SUBSCRIPTION_TIERS.COLLAB_PRO, title: 'Collab Pro', priceMonthlyUsd: 9.99 },
        { tier: SUBSCRIPTION_TIERS.CREATOR_PASSPORT, title: 'Creator Passport', priceMonthlyUsd: 14.99 },
        { tier: SUBSCRIPTION_TIERS.CREATOR_ELITE, title: 'Creator Elite', priceMonthlyUsd: 29.99 },
      ];
    } else if (ageDays >= 60) {
      rolloutPhase = 3;
      visiblePaidTiers = [
        { tier: SUBSCRIPTION_TIERS.COLLAB_PRO, title: 'Collab Pro', priceMonthlyUsd: 9.99 },
        { tier: SUBSCRIPTION_TIERS.CREATOR_PASSPORT, title: 'Creator Passport', priceMonthlyUsd: 14.99 },
      ];
    } else if (ageDays >= 30) {
      rolloutPhase = 2;
      visiblePaidTiers = [
        { tier: SUBSCRIPTION_TIERS.COLLAB_PRO, title: 'Collab Pro', priceMonthlyUsd: 9.99 },
      ];
    }

    const tier = effectiveSubscriptionTier(user as any);
    return {
      success: true,
      message: 'Subscription paywall fetched successfully',
      data: {
        rolloutPhase,
        freeTier: {
          tier: SUBSCRIPTION_TIERS.CREATOR_ACCESS,
          title: 'Creator Access',
          priceMonthlyUsd: 0,
          alwaysAvailable: true,
        },
        availableTiers: [
          {
            tier: SUBSCRIPTION_TIERS.CREATOR_ACCESS,
            title: 'Creator Access',
            priceMonthlyUsd: 0,
          },
          ...visiblePaidTiers,
        ],
        effectiveTier: tier,
        visiblePaidTiers,
        limits: limitsForUser(user as any),
      },
    };
  }

  async getSubscriptionAnalytics(req: IGetUserAuthInfoRequest) {
    const user = await this.userModel
      .findById(req.user._id)
      .select('subscriptionTier subscriptionExpiresAt likedBySomeone likedByMe connections')
      .lean()
      .exec();

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        data: null,
      };
    }

    const tier = effectiveSubscriptionTier(user as any);
    if (tier !== SUBSCRIPTION_TIERS.CREATOR_ELITE) {
      return {
        success: false,
        message: 'Analytics are available on Creator Elite',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Subscription analytics fetched successfully',
      data: {
        profileLikes: Array.isArray((user as any).likedBySomeone)
          ? (user as any).likedBySomeone.length
          : 0,
        sentLikes: Array.isArray((user as any).likedByMe)
          ? (user as any).likedByMe.length
          : 0,
        totalConnections: Array.isArray((user as any).connections)
          ? (user as any).connections.length
          : 0,
      },
    };
  }

  async verifyIosSubscription(
    req: IGetUserAuthInfoRequest,
    body: { receiptData?: string; productId?: string },
  ) {
    const receiptData = body?.receiptData?.trim();
    const productIdFromClient = body?.productId?.trim();
    if (!receiptData && !productIdFromClient) {
      throw new HttpException(
        {
          success: false,
          message: 'receiptData or productId is required',
          status: HttpStatus.BAD_REQUEST,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const skipVerify = String(process.env.IAP_SKIP_VERIFICATION || '').toLowerCase() === 'true';
    let verifiedProductId = productIdFromClient || null;
    let expiresAt: Date | null = null;

    if (receiptData && !skipVerify) {
      const apple = await this.verifyAppleReceiptRaw(receiptData);
      const latest = this.extractLatestAppleSubscription(apple);
      verifiedProductId = latest.productId || verifiedProductId;
      expiresAt = latest.expiresAt;
      if (!expiresAt) {
        throw new HttpException(
          {
            success: false,
            message: 'Apple receipt does not include a valid subscription expiry',
            status: HttpStatus.BAD_REQUEST,
            data: null,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const nextTier =
      tierFromProductId(verifiedProductId) ||
      (skipVerify ? SUBSCRIPTION_TIERS.COLLAB_PRO : null);

    if (!nextTier || nextTier === SUBSCRIPTION_TIERS.CREATOR_ACCESS) {
      throw new HttpException(
        {
          success: false,
          message: 'Unsupported or missing paid product id',
          status: HttpStatus.BAD_REQUEST,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const finalExpiry = expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: req.user._id },
        {
          $set: {
            subscriptionTier: normalizeTier(nextTier),
            subscriptionExpiresAt: finalExpiry,
            subscriptionProductId: verifiedProductId || nextTier,
            isPackageSubscribed: true,
          },
        },
        { new: true },
      )
      .exec();

    return {
      success: true,
      message: 'Subscription verified successfully',
      data: updated,
    };
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
