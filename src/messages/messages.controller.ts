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
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { AuthGuard } from 'src/guards/auth.guard';
import { IGetUserAuthInfoRequest } from 'src/interfaces';
import { FileInterceptor } from '@nestjs/platform-express';
import { storage } from 'src/users/users.controller';

@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('mediaFile', storage))
  create(
    @Body() createMessageDto: any,
    @Req() req: IGetUserAuthInfoRequest,
    @UploadedFile() file: Express.Multer.File | any,
  ) {
    console.log({ createMessageDto });
    if (file) {
      console.log(file);
      let mediaFile = {
        url: `http://${req.get('host')}/${file?.filename}`,
        type: file.mimetype,
      };
      createMessageDto.mediaFile = mediaFile;
    }
    return this.messagesService.create(createMessageDto);
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
