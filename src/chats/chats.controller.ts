import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { IGetUserAuthInfoRequest } from 'src/interfaces';
import { AuthGuard } from 'src/guards/auth.guard';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  create(@Body() createChatDto: CreateChatDto) {
    return this.chatsService.create(createChatDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll(@Req() req: IGetUserAuthInfoRequest) {
    return this.chatsService.findAll(req);
  }

  @Get('/getSingleChat')
  @UseGuards(AuthGuard)
  findSingleChat(@Req() req: IGetUserAuthInfoRequest) {
    return this.chatsService.findOne({ _id: req.query.chatId });
  }

  @Patch()
  @UseGuards(AuthGuard)
  resetUnreadMessageCount(@Req() req: IGetUserAuthInfoRequest) {
    let body: any = req.body;
    return this.chatsService.update(
      { _id: body.chatId },
      { 'unReadMessage.unReadMessageCount': 0 },
    );
  }

  @Patch('/updateChatSession')
  @UseGuards(AuthGuard)
  updateChatSession(@Req() req: IGetUserAuthInfoRequest) {
    let body: UpdateChatDto = req.body;
    console.log({ body });
    return this.chatsService.update(
      { _id: body.chatId },
      {
        chatSessionId: body.chatSessionId,
        isChatSession: body.isChatSession,
      },
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
    return this.chatsService.update(+id, updateChatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatsService.remove(+id);
  }
}
