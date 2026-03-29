import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MediaTypeEnum } from './message.schema';
import { AuthGuard } from 'src/guards/auth.guard';
import { IGetUserAuthInfoRequest } from 'src/interfaces';
import { FileInterceptor } from '@nestjs/platform-express';
import { storage } from 'src/users/users.controller';
import { ChatsGateway } from 'src/chats/chats.gateway';

@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    @Inject(forwardRef(() => ChatsGateway))
    private readonly chatsGateway: ChatsGateway,
  ) {}

  /** JSON body (no multipart) — reliable for React Native text sends; avoids Android axios+FormData issues. */
  @Post('text')
  async createText(
    @Body() createMessageDto: any,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    const result = await this.messagesService.create(createMessageDto);
    try {
      this.chatsGateway.emitMessageToReceiver(result);
      const doc: any = result?.data;
      if (doc?.chatId && doc?.from != null && doc?.to != null) {
        this.chatsGateway.emitChatListRefresh(String(doc.chatId), [
          String(doc.from),
          String(doc.to),
        ]);
      }
    } catch (e) {
      console.warn('Socket emit after message create failed', e);
    }
    return result;
  }

  @Post()
  @UseInterceptors(FileInterceptor('mediaFile', storage))
  async create(
    @Body() createMessageDto: any,
    @Req() req: IGetUserAuthInfoRequest,
    @UploadedFile() file: Express.Multer.File | any,
  ) {
    console.log({ createMessageDto });
    if (file) {
      console.log(file);
      const kind = file.mimetype?.startsWith('video/')
        ? MediaTypeEnum.VIDEO
        : MediaTypeEnum.IMAGE;
      const protocol =
        req.get('x-forwarded-proto') ||
        (req as { protocol?: string }).protocol ||
        'http';
      const host = req.get('host');
      const name = encodeURIComponent(file.filename || 'media');
      /** Static route is `app.use('/uploads', …)` in main.ts — path must include `/uploads/`. */
      createMessageDto.mediaFile = {
        url: `${protocol}://${host}/uploads/${name}`,
        type: kind,
      };
    }
    const result = await this.messagesService.create(createMessageDto);
    try {
      this.chatsGateway.emitMessageToReceiver(result);
      const doc: any = result?.data;
      if (doc?.chatId && doc?.from != null && doc?.to != null) {
        this.chatsGateway.emitChatListRefresh(String(doc.chatId), [
          String(doc.from),
          String(doc.to),
        ]);
      }
    } catch (e) {
      console.warn('Socket emit after message create failed', e);
    }
    return result;
  }

  @Get()
  findAll(@Req() req: IGetUserAuthInfoRequest) {
    return this.messagesService.findAll(req);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messagesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMessageDto: UpdateMessageDto) {
    return this.messagesService.update(+id, updateMessageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.messagesService.remove(+id);
  }
}
