import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '../guards/auth.guard';
import { IGetUserAuthInfoRequest } from '../interfaces';
import { SendMessageDto } from './dtos/send-message.dto';
import { StartConversationDto } from './dtos/start-conversation.dto';
import { MessageType } from './schemas/message.schema';
import { B2StorageService } from '../media/b2-storage.service';

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

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly b2: B2StorageService,
  ) {}

  /** GET /conversations - chat list with unread counts */
  @Get()
  async getConversations(
    @Req() req: IGetUserAuthInfoRequest,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.conversationsService.getConversations(
      req,
      limit ? parseInt(limit, 10) : 50,
      page ? parseInt(page, 10) : 1,
    );
  }

  /** POST /:conversationId/read - mark conversation as read for current user (unread count = 0). Call when user opens chat. */
  @Post(':conversationId/read')
  async markConversationRead(
    @Param('conversationId') conversationId: string,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    const userId = (req as any).user?._id ?? (req as any).user?.sub ?? (req as any).user?.id;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    if (!conversationId) throw new HttpException('conversationId required', HttpStatus.BAD_REQUEST);
    await this.conversationsService.markAsRead(conversationId, String(userId));
    return { success: true, message: 'Marked as read' };
  }

  /** GET /messages/:conversationId - paginated messages */
  @Get('messages/:conversationId')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Req() req: IGetUserAuthInfoRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!conversationId) {
      throw new HttpException('conversationId required', HttpStatus.BAD_REQUEST);
    }
    return this.conversationsService.getMessages(
      conversationId,
      req,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** POST /start - create or get existing 1-to-1 conversation */
  @Post('start')
  async startConversation(
    @Body() body: StartConversationDto,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    return this.conversationsService.startConversation(body.otherUserId, req);
  }

  /** POST /upload-image - upload chat image; returns { url } for use as message content */
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('image', { ...chatImageStorage, limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(@Req() req: IGetUserAuthInfoRequest, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new HttpException('Image file required', HttpStatus.BAD_REQUEST);
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    let url = `${baseUrl}/uploads/chat/${file.filename}`;
    if (this.b2.isEnabled() && file.path) {
      try {
        const uid = String(req.user?._id ?? 'anon');
        url = await this.b2.uploadLocalAndUnlink(
          file.path,
          `chat/${uid}/${file.filename}`,
          file.mimetype || 'image/jpeg',
        );
      } catch (e) {
        this.logger.warn('B2 conversations image upload failed; using local URL', e);
      }
    }
    return { success: true, data: { url } };
  }

  /** POST /send-message - fallback when socket fails; supports text and image (content = URL) */
  @Post('send-message')
  async sendMessage(@Body() body: SendMessageDto, @Req() req: IGetUserAuthInfoRequest) {
    const userId = (req as any).user?._id ?? (req as any).user?.sub ?? (req as any).user?.id;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    const content = (body.content ?? body.text ?? '').trim();
    if (!content) throw new HttpException('Message content or text required', HttpStatus.BAD_REQUEST);
    const type = body.type === 'image' ? MessageType.IMAGE : MessageType.TEXT;
    const msg = await this.conversationsService.createMessage(
      body.conversationId,
      String(userId),
      body.receiverId,
      content,
      { type },
    );
    const populated = await msg.populate('senderId', 'firstName lastName profileImage profileVideo');
    const data = populated.toObject ? populated.toObject() : (populated as any);
    return { success: true, data };
  }

  /** DELETE /:conversationId - soft delete */
  @Delete(':conversationId')
  async deleteConversation(
    @Param('conversationId') conversationId: string,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    await this.conversationsService.deleteConversation(conversationId, req);
    return { success: true, message: 'Conversation deleted' };
  }
}
