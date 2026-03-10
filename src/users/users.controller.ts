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

import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { ChatsService } from 'src/chats/chats.service';
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
    private readonly chatService: ChatsService,
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
  @UsePipes(LogRequestPipe, new ValidationPipe())
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profileVideo', maxCount: 1 },
        { name: 'videos', maxCount: 6 },
      ],
      storage,
    ),
  )
  updateProfile(
    @Req() req: IGetUserAuthInfoRequest,
    @Body() body: UpdateUserDTO,
    @UploadedFiles()
    files: {
      videos?: Express.Multer.File[];
      profileVideo?: Express.Multer.File;
    },
  ) {
    console.log('update', files);

    let videoArr = [];
    let previousVideos = body.previousVideos
      ? JSON.parse(body.previousVideos)
      : [];

    if (files && files.videos) {
      videoArr = files.videos.map((file) => {
        return { url: `http://${req.get('host')}/uploads/${file?.filename}` };
      });
      console.log({ fileVideos: videoArr });
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

    if (files && files.profileVideo) {
      console.log(
        { profileVideo: files.profileVideo },
        `http://${req.get('host')}/uploads/${files[0]?.filename}`,
      );
      body.profileVideo = `http://${req.get('host')}/uploads/${files
        .profileVideo[0]?.filename}`;
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

      console.log({
        userLikedByMe: body.userLikedByMe,
        currentUser: req.user._id,
      });

      let chatDate: any = {
        chatName: '',
        users: [req.user._id, body.userLikedByMe],
        latestMessage: '',
      };
      this.chatService.create(chatDate);
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

  @Get('/myProfile')
  @UseGuards(AuthGuard)
  myProfile(@Req() req: IGetUserAuthInfoRequest) {
    console.log({ user: req.user });
    return this.usersService.findOne({ _id: req.user._id });
  }

  @Get('/othersProfile/:id')
  @UseGuards(AuthGuard)
  othersProfile(@Param('id') id: string) {
    return this.usersService.findOne({ _id: id });
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
