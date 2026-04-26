import {
  Controller,
  Post,
  Body,
  Put,
  Req,
  UseGuards,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  ValidationPipe,
  UsePipes,
  UploadedFiles,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { LoginDTO } from './dtos/loginUser.dto';
import { CreateUserDTO } from './dtos/createUser.dto';
import { VerifyUserDTO } from './dtos/verifyUser.dto';
import { SendOtpDTO } from './dtos/sendOTP.dto';
import { ResetPasswordDTO } from './dtos/resetPassword.dto';
import { IGetUserAuthInfoRequest, genericResponseType } from 'src/interfaces';
import { UpdateUserDTO } from './dtos/updateUser.dto';
import { AuthGuard } from 'src/guards/auth.guard';
import { BlockUserDTO } from './dtos/blockUserDto';
import { LikeUserDTO } from './dtos/likeUser';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationEnum } from 'src/notifications/enums';
import { ChatsService } from 'src/chats/chats.service';
import { MediaService } from 'src/media/media.service';

import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { SuperLikeUserDTO } from './dtos/superLikeUser.dto';
import { LogRequestPipe } from 'src/pipes/logs.pipe';
import { AdminLoginDTO } from './dtos/adminLogin.dto';

export const storage = {
  storage: diskStorage({
    destination: './uploads',
    filename: (req: any, file, cb) => {
      const authReq = req as IGetUserAuthInfoRequest;
      const filename: string = (authReq?.user?._id ?? '') + file.originalname;
      cb(null, filename);
    },
  }),
};

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationService: NotificationsService,
    private readonly chatsService: ChatsService,
    private readonly mediaService: MediaService,
  ) {}

  @Post('/adminRegister')
  adminRegister(@Body() body: AdminLoginDTO) {
    return this.usersService.adminRegister(body);
  }
  @Post('/sendOtp')
  sendOtp(@Body() body: SendOtpDTO) {
    return this.usersService.sendOtp(body);
  }

  @Put('/verifyUser')
  verifyUser(@Body() body: VerifyUserDTO) {
    return this.usersService.verifyUser(body);
  }

  @Post('/login')
  loginUser(@Body() body: LoginDTO): Promise<genericResponseType> {
    return this.usersService.login(body);
  }

  @Post('/adminLogin')
  adminLogin(@Body() body: AdminLoginDTO): Promise<genericResponseType> {
    return this.usersService.adminLogin(body);
  }

  @Post('/forgetPassword')
  forgetPassword(@Body() body: SendOtpDTO) {
    return this.usersService.sendOtp(body);
  }

  @Put('/updateProfile')
  @UsePipes(
    LogRequestPipe,
    new ValidationPipe({ transform: true }),
  )
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profileVideo', maxCount: 1 },
        { name: 'videos', maxCount: 6 },
        { name: 'profileImage', maxCount: 1 },
      ],
      storage,
    ),
  )
  async updateProfile(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: UpdateUserDTO,
    @UploadedFiles()
    files: {
      videos?: Express.Multer.File[];
      profileVideo?: Express.Multer.File[];
      profileImage?: Express.Multer.File[];
    },
  ) {
    console.log('update', files);

    const host = req.get('host');
    const userId = String(req.user._id);
    const stamp = Date.now();

    if (files?.profileImage?.[0]) {
      body.profileImage = await this.mediaService.processImageUpload(
        files.profileImage[0],
        host,
        `${userId}_pimg_${stamp}`,
      );
    }

    let videoArr: { url: string; thumbnailUrl?: string }[] = [];
    let previousVideos = body.previousVideos
      ? JSON.parse(body.previousVideos as unknown as string)
      : [];

    const limits = await this.usersService.getCurrentTierLimits(String(req.user._id));
    const requestedVideoCount =
      (Array.isArray(previousVideos) ? previousVideos.length : 0) +
      (files?.videos?.length || 0);
    if (requestedVideoCount > limits.maxProfileVideos) {
      throw new HttpException(
        {
          success: false,
          message: `Your current plan allows up to ${limits.maxProfileVideos} videos`,
          data: null,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (files?.videos?.length) {
      for (let i = 0; i < files.videos.length; i++) {
        const file = files.videos[i];
        const processed = await this.mediaService.processUploadedVideo(
          file,
          host,
          `${userId}_v_${stamp}_${i}`,
        );
        videoArr.push({
          url: processed.url,
          thumbnailUrl: processed.thumbnailUrl || undefined,
        });
      }
      body.videos = videoArr;
    }

    if (previousVideos.length) {
      videoArr = [...previousVideos, ...videoArr];
      console.log({ filePrevVideos: videoArr });
      body.videos = videoArr;
    }

    if (body && body.emptyVideos == true) {
      body.videos = [];
    }

    if (files?.profileVideo?.[0]) {
      const processed = await this.mediaService.processUploadedVideo(
        files.profileVideo[0],
        host,
        `${userId}_pv_${stamp}`,
      );
      body.profileVideo = processed.url;
      body.profileVideoThumbnail = processed.thumbnailUrl || undefined;
    }

    return this.usersService.findOneAndUpdate({ _id: req.user._id }, body);
  }

  @Post('/blockUser')
  @UseGuards(AuthGuard)
  addUserToBlockList(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: BlockUserDTO,
  ) {
    console.log({ user: req.user });
    return this.usersService.findOneAndUpdate(
      { _id: req.user._id },
      {
        $push: {
          blockUsers: {
            blockedUserId: body.userToBlock,
            reason: body.reason,
          },
        },
      },
    );
  }

  @Post('/likeUser')
  @UseGuards(AuthGuard)
  async likeUsers(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: LikeUserDTO,
  ) {
    const swipeCheck = await this.usersService.consumeSwipeForLike(String(req.user._id));
    if (!swipeCheck.success) {
      return swipeCheck;
    }

    if (String(req.user._id) === String(body.userLikedByMe)) {
      return {
        success: false,
        message: 'You cannot like your own profile',
        data: null,
      };
    }

    let alreadyLikedByOtherUser = await this.usersService.userModel.findOne({
      _id: req.user._id,
      likedBySomeone: body.userLikedByMe,
    });

    let updateUser;

    if (alreadyLikedByOtherUser) {
      // create chat
      console.log('already like by other user');

      updateUser = await this.usersService.findOneAndUpdate(
        { _id: req.user._id },
        {
          $push: { likedByMe: body.userLikedByMe },
          $pull: { unLikedByMe: body.userLikedByMe },
        },
      );

      await this.usersService.findOneAndUpdate(
        { _id: body.userLikedByMe },
        {
          $push: { likedBySomeone: req.user._id },
        },
      );

      await this.chatsService.create({
        chatName: 'Match',
        users: [req.user._id as any, body.userLikedByMe as any],
        latestMessage: '',
      });

      console.log({
        userLikedByMe: body.userLikedByMe,
        currentUser: req.user._id,
      });
    } else {
      // console.log('else block');
      updateUser = await this.usersService.findOneAndUpdate(
        { _id: req.user._id },
        {
          $push: { likedByMe: body.userLikedByMe },
          $pull: { unLikedByMe: body.userLikedByMe },
        },
      );

      await this.usersService.findOneAndUpdate(
        { _id: body.userLikedByMe },
        {
          $push: { likedBySomeone: req.user._id },
        },
      );
    }

    if (updateUser.success == true) {
      this.notificationService.create({
        to: body.userLikedByMe,
        from: req.user._id,
        type: NotificationEnum.LIKE,
        title: 'New Like',
        description: `Congratulations! You have received a new like from ${updateUser.data.firstName} ${updateUser.data.lastName}`,
      });
    }
    return updateUser;
  }

  @Post('/superLikeUser')
  @UseGuards(AuthGuard)
  superLikeToUser(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: SuperLikeUserDTO,
  ) {
    if (!this.usersService.canUseSuperLike(req.user)) {
      return {
        success: false,
        message: 'Super like is available on Collab Pro and above',
        data: null,
      };
    }
    return this.usersService.superLike(
      { _id: body.userSuperLikedByMe },
      {
        $inc: {
          superLikeCount: 1,
        },
      },
    );
  }

  @Post('/unLikeUser')
  @UseGuards(AuthGuard)
  async unLikeUser(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: { userUnLikedByMe: string },
  ) {
    console.log({ body });
    this.usersService.findOneAndUpdate(
      { _id: req.user._id },
      {
        $push: { unLikedByMe: body.userUnLikedByMe },
        $pull: { likedByMe: body.userUnLikedByMe },
      },
    );
    this.usersService.findOneAndUpdate(
      { _id: body.userUnLikedByMe },
      {
        $pull: { likedBySomeone: req.user._id },
      },
    );
    return {
      success: true,
      message: 'You have unlike this user',
      data: null,
    };
  }

  @Put('/updateNotifications')
  @UseGuards(AuthGuard)
  updateUser(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: { pushNotificationEnabled: boolean },
  ) {
    return this.usersService.findOneAndUpdate({ _id: req.user._id }, body);
  }

  @Post('/connectUser')
  @UseGuards(AuthGuard)
  connectUser(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: { userToConnect: string },
  ) {
    return this.usersService.connectUser(req, body);
  }

  @Post('/dashboardListing')
  @UseGuards(AuthGuard)
  dashboardListing(@Req() req: IGetUserAuthInfoRequest) {
    return this.usersService.findAll(req);
  }

  @Get('/getAllLikedUsers')
  @UseGuards(AuthGuard)
  getAllLikedUsers(@Req() req: IGetUserAuthInfoRequest) {
    return this.usersService.getAllLikedUsers(req);
  }

  @Get('/getAllUsersWhoLikedMe')
  @UseGuards(AuthGuard)
  getAllUsersWhomLikedMe(@Req() req: IGetUserAuthInfoRequest) {
    return this.usersService.getAllUsersWhomLikedMe(req);
  }

  @Get('/subscription/paywall')
  @UseGuards(AuthGuard)
  getSubscriptionPaywall(@Req() req: IGetUserAuthInfoRequest) {
    return this.usersService.getSubscriptionPaywall(req);
  }

  @Get('/subscription/analytics')
  @UseGuards(AuthGuard)
  getSubscriptionAnalytics(@Req() req: IGetUserAuthInfoRequest) {
    return this.usersService.getSubscriptionAnalytics(req);
  }

  @Post('/subscriptions/verify-ios')
  @UseGuards(AuthGuard)
  verifyIosSubscription(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: { receiptData?: string; productId?: string },
  ) {
    return this.usersService.verifyIosSubscription(req, body);
  }

  @Get('/myProfile')
  @UseGuards(AuthGuard)
  myProfile(@Req() req: IGetUserAuthInfoRequest) {
    console.log({ user: req.user });
    return this.usersService.findOne({ _id: req.user._id });
  }

  /** @deprecated Prefer GET /users/by-id/:id (same behaviour). */
  @Get('/othersProfile/:id')
  @UseGuards(AuthGuard)
  othersProfile(@Param('id') id: string) {
    return this.usersService.getUserProfileById(id);
  }

  /** Get another user’s profile (or your own) by MongoDB `_id`. Requires Bearer token. */
  @Get('/by-id/:id')
  @UseGuards(AuthGuard)
  getUserById(@Param('id') id: string) {
    return this.usersService.getUserProfileById(id);
  }

  @Post('/deactive')
  @UseGuards(AuthGuard)
  deactive(@Req() req: IGetUserAuthInfoRequest) {
    console.log({ user: req.user });
    return this.usersService.findOneAndUpdate(
      { _id: req.user._id },
      {
        isDeleted: true,
        reasonToDeleteAccount: req.body.reasonToDeleteAccount,
      },
    );
  }

  @Post('/logout')
  @UseGuards(AuthGuard)
  logout(@Req() req: IGetUserAuthInfoRequest) {
    console.log({ user: req.user });
    return this.usersService.findOneAndUpdate(
      { _id: req.user._id },
      {
        deviceToken: '',
      },
    );
  }

  // Admin APIS

  @Get('/list')
  @UseGuards(AuthGuard)
  listUsers(@Req() req: IGetUserAuthInfoRequest) {
    return this.usersService.listUsers(req);
  }

  @Get('/getAll')
  // @UseGuards(AuthGuard)
  findAllUsers(@Req() req: IGetUserAuthInfoRequest) {
    return this.usersService.findAllForAdmin(req);
  }

  @Get('/rewind')
  @UseGuards(AuthGuard)
  async rewind(@Req() req: IGetUserAuthInfoRequest) {
    return this.usersService.rewind(req);
  }
}
