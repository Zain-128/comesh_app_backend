import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthGuard } from '../guards/auth.guard';
import { IGetUserAuthInfoRequest } from '../interfaces';
import { CreateSingleChatDto } from './dto/create-single-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatRequestDto } from './dto/chat-request.dto';

const uploadsChatDir = join(process.cwd(), 'uploads', 'chat');
const chatImageStorage = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(uploadsChatDir)) mkdirSync(uploadsChatDir, { recursive: true });
      cb(null, uploadsChatDir);
    },
    filename: (_req: any, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname) || '.jpg'}`;
      cb(null, unique);
    },
  }),
};

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /** GET /chat/get-all-chats-by-user-id - list from user.chatIds, with lastMessage + unread */
  @Get('get-all-chats-by-user-id')
  async getAllChatsByUserId(@Req() req: IGetUserAuthInfoRequest) {
    return this.chatService.getAllChatsByUserId(req);
  }

  /** GET /chat/get-chat-requests - pending requests where current user is requestedTo */
  @Get('get-chat-requests')
  async getChatRequests(@Req() req: IGetUserAuthInfoRequest) {
    return this.chatService.getChatRequests(req);
  }

  /** GET /chat/get-messages?chatId=&page=&limit= */
  @Get('get-messages')
  async getMessages(
    @Query('chatId') chatId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: IGetUserAuthInfoRequest,
  ) {
    if (!chatId) throw new HttpException('chatId required', HttpStatus.BAD_REQUEST);
    return this.chatService.getMessagesByChatId(
      chatId,
      req!,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** POST /chat/create-single-chat - body { otherUserId } */
  @Post('create-single-chat')
  async createSingleChat(
    @Body() body: CreateSingleChatDto,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    return this.chatService.createSingleChat(body.otherUserId, req);
  }

  /** POST /chat/upload-image - multipart form "image"; returns { success, data: { url } } */
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image', { ...chatImageStorage, limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(@Req() req: IGetUserAuthInfoRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new HttpException('Image file required', HttpStatus.BAD_REQUEST);
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/chat/${file.filename}`;
    return { success: true, data: { url } };
  }

  /** POST /chat/send-message */
  @Post('send-message')
  async sendMessage(
    @Body() body: SendMessageDto,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    const userId = (req as any).user?._id ?? (req as any).user?.sub ?? (req as any).user?.id;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    const msg = await this.chatService.createMessage(
      body.chatId,
      String(userId),
      body.content,
      (body.messageType as any) || 'text',
    );
    const populated = await msg.populate('sender', 'firstName lastName profileImage profileVideo');
    const messageData = populated.toObject ? populated.toObject() : populated;

    const chat = await this.chatService.getChatById(body.chatId);
    if (chat) {
      const receiverId = chat.users.find((u) => String(u) !== String(userId));
      if (receiverId) {
        this.chatGateway.emitToUser(receiverId, 'chat_message', {
          chatId: body.chatId,
          message: messageData,
        });
      }
    }

    return { success: true, data: messageData };
  }

  /** POST /chat/accept-chat-request */
  @Post('accept-chat-request')
  async acceptChatRequest(
    @Body() body: ChatRequestDto,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    return this.chatService.acceptChatRequest(body.chatId, req);
  }

  /** POST /chat/reject-chat-request */
  @Post('reject-chat-request')
  async rejectChatRequest(
    @Body() body: ChatRequestDto,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    return this.chatService.rejectChatRequest(body.chatId, req);
  }

  /** POST /chat/mark-read - body { chatId } */
  @Post('mark-read')
  async markRead(
    @Body() body: ChatRequestDto,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    return this.chatService.markChatRead(body.chatId, req);
  }
}
