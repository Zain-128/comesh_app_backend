import { Injectable } from '@nestjs/common';
import { startSession, ClientSession } from 'mongoose';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { InjectModel } from '@nestjs/mongoose';
import { MessageDocument, MessageSchemaName } from './message.schema';
import { Model } from 'mongoose';
import { pagination } from 'src/utils/pagination';
import { IGetUserAuthInfoRequest } from 'src/interfaces';
import { ChatsService } from 'src/chats/chats.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(MessageSchemaName)
    private readonly MessageModel: Model<MessageDocument>,
    private readonly ChatService: ChatsService,
  ) { }

  async create(createMessageDto: CreateMessageDto & { replyToMessageId?: string }) {
    console.log({ createMessageDto });
    const dto: any = { ...createMessageDto };
    const replyId = dto.replyToMessageId;
    if (replyId) {
      delete dto.replyToMessageId;
      const orig = await this.MessageModel.findById(replyId).lean();
      if (
        orig &&
        String(orig.chatId) === String(dto.chatId)
      ) {
        dto.replyTo = {
          _id: orig._id,
          message: orig.message ?? '',
          messageType: orig.messageType,
          from: orig.from,
          mediaFile: orig.mediaFile
            ? {
                url: (orig.mediaFile as { url?: string }).url,
                type: String((orig.mediaFile as { type?: string }).type ?? ''),
              }
            : undefined,
        };
      }
    }
    let message = await this.MessageModel.create(dto);

    if (message.chatId) {
      // 1. Try to increment existing count for user
      const now = new Date();
      const listMeta = {
        latestMessage: message.message,
        latestMessageTime: new Date(message.createdAt).toISOString(),
        updatedAt: now,
      };
      let chat = await this.ChatService.ChatModel.findOneAndUpdate(
        { _id: message.chatId, 'unReadMessage.userId': message.to },
        {
          $set: {
            ...listMeta,
          },
          $inc: { 'unReadMessage.$.unReadMessageCount': 1 },
        },
        { new: true },
      );

      // 2. If user not found in unReadMessage array, push new entry
      if (!chat) {
        chat = await this.ChatService.ChatModel.findOneAndUpdate(
          { _id: message.chatId },
          {
            $set: listMeta,
            $push: {
              unReadMessage: {
                userId: message.to,
                unReadMessageCount: 1,
              },
            },
          },
          { new: true },
        );
      }

      console.log({ chat });
    }

    return {
      success: true,
      message: 'Message sent successfully',
      data: message,
    };
  }

  async findAll(req: IGetUserAuthInfoRequest) {
    let customQueries = {
      $or: [{ to: req.user._id }, { from: req.user._id }],
    };

    if (req.query.chat) {
      customQueries['chatId'] = req.query.chat;
    }

    // req.query.order = 'createdAt';
    // req.query.sort = 'asc';
    let message = await pagination(this.MessageModel, req, customQueries);

    return {
      success: true,
      message: 'Message fetched successfully',
      data: message,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} message`;
  }

  update(id: number, updateMessageDto: UpdateMessageDto) {
    return `This action updates a #${id} message`;
  }

  remove(id: number) {
    return `This action removes a #${id} message`;
  }

  async markAsRead(chatId: string, userId: string) {
    // 1. Update all messages in this chat sent TO this user as read
    await this.MessageModel.updateMany(
      { chatId, to: userId, isRead: false },
      { $set: { isRead: true } },
    );

    // 2. Reset unread count for this user in the Chat model
    await this.ChatService.ChatModel.updateOne(
      { _id: chatId, 'unReadMessage.userId': userId },
      { $set: { 'unReadMessage.$.unReadMessageCount': 0 } },
    );

    return { success: true, message: 'Marked as read' };
  }
}
