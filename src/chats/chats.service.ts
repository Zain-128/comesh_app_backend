import { Injectable } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CategoryDocument } from 'src/categories/category.schema';
import { chatSchemaName } from './chat.schema';
import { paginationWithAggregation } from 'src/utils/paginationWithAggregation';
import { IGetUserAuthInfoRequest } from 'src/interfaces';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(chatSchemaName)
    readonly ChatModel: Model<CategoryDocument>,
  ) {}

  async create(createChatDto: CreateChatDto) {
    console.log({ createChatDto });
    let chatExists = await this.ChatModel.findOne({
      users: { $all: createChatDto.users, $size: createChatDto.users.length },
    });

    console.log({ chatExists });

    if (chatExists) {
      return {
        success: true,
        message: 'Chat is already created',
        data: chatExists,
      };
    } else {
      let chat = await this.ChatModel.create(createChatDto);

      return {
        success: true,
        message: 'Chat created successfully',
        data: chat,
      };
    }
  }

  async findAll(req: IGetUserAuthInfoRequest) {
    let customQueries = {
      users: req.user._id,
    };
    let customLookup = [
      {
        $lookup: {
          from: 'users',
          let: { usersArr: '$users' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    '$_id',
                    {
                      $map: {
                        input: '$$usersArr',
                        as: 'user',
                        in: { $toObjectId: '$$user' },
                      },
                    },
                  ],
                },
              },
            },
            {
              $project: {
                firstName: 1,
                lastName: 1,
                profileImage: 1,
                profileVideoThumbnail: 1,
              },
            },
          ],
          as: 'usersData',
        },
      },
    ];

    let chatList = await paginationWithAggregation(
      this.ChatModel,
      req,
      customQueries,
      customLookup,
    );

    console.log(chatList);

    chatList.data = chatList?.data.map((chat) => {
      console.log({ chat });
      return {
        ...chat,
        usersData: chat.usersData.filter((user) => user._id != req.user._id),
      };
    });

    return {
      success: true,
      message: 'Chat created successfully',
      data: chatList,
    };
  }

  async findOne(filter: any) {
    let chat = await this.ChatModel.findOne(filter);

    return {
      success: true,
      message: 'Chat fetched successfully',
      data: chat,
    };
  }

  async update(filter: any, updateChatDto: any) {
    let updatedChat = await this.ChatModel.findOneAndUpdate(
      filter,
      updateChatDto,
      {
        new: true,
        upsert: true,
      },
    );

    return {
      success: true,
      message: 'Chat updated successfully',
      data: updatedChat,
    };
  }

  /**
   * `unReadMessage` is an array of { userId, unReadMessageCount }.
   * Must use positional `$` after matching the current user on the array.
   */
  async resetUnreadMessageCount(chatId: string, userId: string) {
    if (!chatId || !userId) {
      return {
        success: false,
        message: 'chatId and user context are required',
        data: null,
      };
    }
    const updatedChat = await this.ChatModel.findOneAndUpdate(
      { _id: chatId, 'unReadMessage.userId': userId },
      { $set: { 'unReadMessage.$.unReadMessageCount': 0 } },
      { new: true },
    );

    return {
      success: true,
      message: updatedChat
        ? 'Chat updated successfully'
        : 'No matching unread row (skipped)',
      data: updatedChat,
    };
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
