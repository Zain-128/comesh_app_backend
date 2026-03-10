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
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '../guards/auth.guard';
import { IGetUserAuthInfoRequest } from '../interfaces';
import { SendMessageDto } from './dtos/send-message.dto';
import { StartConversationDto } from './dtos/start-conversation.dto';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

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

  /** POST /send-message - fallback when socket fails */
  @Post('send-message')
  async sendMessage(@Body() body: SendMessageDto, @Req() req: IGetUserAuthInfoRequest) {
    const userId = (req as any).user?._id ?? (req as any).user?.sub ?? (req as any).user?.id;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    const msg = await this.conversationsService.createMessage(
      body.conversationId,
      String(userId),
      body.receiverId,
      body.text.trim(),
    );
    const populated = await msg.populate('senderId', 'firstName lastName profileImage');
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
