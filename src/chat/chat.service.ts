import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument, CHAT_SCHEMA_NAME } from './schemas/chat.schema';
import {
  ChatMessage,
  ChatMessageDocument,
  CHAT_MESSAGE_SCHEMA_NAME,
  MessageType,
} from './schemas/chat-message.schema';
import { IGetUserAuthInfoRequest } from '../interfaces';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(CHAT_SCHEMA_NAME)
    private chatModel: Model<ChatDocument>,
    @InjectModel(CHAT_MESSAGE_SCHEMA_NAME)
    private messageModel: Model<ChatMessageDocument>,
    @InjectModel('User')
    private userModel: Model<any>,
  ) {}

  private getUserId(req: IGetUserAuthInfoRequest): string {
    const id = req.user?._id ?? req.user?.sub ?? req.user?.id;
    if (!id) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return String(id);
  }

  /**
   * Get all chats for user (from user.chatIds), populated with users + lastMessage.
   * Sort by lastMessageAt desc. Include unread count per chat.
   */
  async getAllChatsByUserId(req: IGetUserAuthInfoRequest) {
    const userId = this.getUserId(req);
    const user = await this.userModel.findById(userId).select('chatIds').lean().exec();
    const chatIds = (user as any)?.chatIds ?? [];
    if (!chatIds.length) {
      return { success: true, data: [] };
    }

    const chats = await this.chatModel
      .find({
        _id: { $in: chatIds },
        $or: [
          { requestStatus: 'accepted' },
          { requestStatus: { $exists: false } },
          { requestStatus: null },
          { requestedBy: new Types.ObjectId(userId) },
        ],
      })
      .populate('users', 'firstName lastName profileImage profileVideo email')
      .populate('lastMessage')
      .populate('requestedBy', 'firstName lastName')
      .populate('requestedTo', 'firstName lastName')
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean()
      .exec();

    const list = await Promise.all(
      chats.map(async (chat: any) => {
        const users = chat.users || [];
        const currentIdStr = String(userId);
        let otherUser: any = null;
        if (!chat.isGroup && users.length) {
          const otherId = users
            .map((u: any) => (u?._id != null ? String(u._id) : ''))
            .find((id: string) => id && id !== currentIdStr);
          if (otherId) {
            const doc = await this.userModel
              .findById(otherId)
              .select('firstName lastName email profileImage profileVideo')
              .lean()
              .exec();
            if (doc) {
              const d = doc as any;
              otherUser = {
                _id: String(d._id),
                firstName: d.firstName ?? '',
                lastName: d.lastName ?? '',
                email: d.email ?? '',
                profileImage: d.profileImage ?? '',
                profileVideo: d.profileVideo ?? '',
              };
            }
          }
        }
        const lastReadAt = chat.lastReadAt && chat.lastReadAt[userId]
          ? new Date(chat.lastReadAt[userId])
          : null;
        let unreadCount = 0;
        if (lastReadAt) {
          unreadCount = await this.messageModel.countDocuments({
            chat: chat._id,
            sender: { $ne: new Types.ObjectId(userId) },
            createdAt: { $gt: lastReadAt },
            isDeleted: false,
          });
        } else {
          unreadCount = await this.messageModel.countDocuments({
            chat: chat._id,
            sender: { $ne: new Types.ObjectId(userId) },
            isDeleted: false,
          });
        }
        return {
          ...chat,
          otherUser,
          groupName: chat.groupName || null,
          groupImage: chat.groupImage || null,
          unreadCount,
        };
      }),
    );

    return { success: true, data: list };
  }

  /**
   * Pending chat requests where current user is requestedTo.
   */
  async getChatRequests(req: IGetUserAuthInfoRequest) {
    const userId = this.getUserId(req);
    const chats = await this.chatModel
      .find({
        requestedTo: new Types.ObjectId(userId),
        requestStatus: 'pending',
      })
      .populate('users', 'firstName lastName profileImage profileVideo email')
      .populate('requestedBy', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return { success: true, data: chats };
  }

  /**
   * Find or create 1:1 chat. If first time: create with requestStatus 'pending', requestedBy/To set, add chatId to initiator only.
   * If already exists (same 2 users): return existing.
   */
  async createSingleChat(otherUserId: string, req: IGetUserAuthInfoRequest) {
    const userId = this.getUserId(req);
    if (userId === otherUserId) {
      throw new HttpException('Cannot chat with yourself', HttpStatus.BAD_REQUEST);
    }

    const sorted = [userId, otherUserId].sort();
    let chat = await this.chatModel
      .findOne({
        isGroup: false,
        users: { $all: sorted.map((id) => new Types.ObjectId(id)) },
        $expr: { $eq: [{ $size: '$users' }, 2] },
      })
      .lean()
      .exec();

    if (chat) {
      const populated = await this.chatModel
        .findById(chat._id)
        .populate('users', 'firstName lastName profileImage profileVideo email')
        .populate('lastMessage')
        .lean();
      return { success: true, data: populated };
    }

    chat = await this.chatModel.create({
      users: sorted.map((id) => new Types.ObjectId(id)),
      isGroup: false,
      lastMessage: null,
      lastMessageAt: null,
      requestStatus: 'pending',
      requestedBy: new Types.ObjectId(userId),
      requestedTo: new Types.ObjectId(otherUserId),
      lastReadAt: {},
    });

    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $addToSet: { chatIds: chat._id } },
    );

    const populated = await this.chatModel
      .findById(chat._id)
      .populate('users', 'firstName lastName profileImage profileVideo email')
      .populate('lastMessage')
      .lean();

    return { success: true, data: populated };
  }

  async acceptChatRequest(chatId: string, req: IGetUserAuthInfoRequest) {
    const userId = this.getUserId(req);
    const chat = await this.chatModel.findOne({
      _id: new Types.ObjectId(chatId),
      requestedTo: new Types.ObjectId(userId),
      requestStatus: 'pending',
    });
    if (!chat) {
      throw new HttpException('Chat request not found', HttpStatus.NOT_FOUND);
    }

    await this.chatModel.updateOne(
      { _id: chat._id },
      { $set: { requestStatus: 'accepted' } },
    );

    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $addToSet: { chatIds: chat._id } },
    );

    const requestedBy = (chat as any).requestedBy;
    if (requestedBy) {
      await this.userModel.updateOne(
        { _id: requestedBy },
        { $addToSet: { chatIds: chat._id } },
      );
    }

    const updated = await this.chatModel
      .findById(chatId)
      .populate('users', 'firstName lastName profileImage profileVideo email')
      .populate('lastMessage')
      .lean();

    return { success: true, data: updated };
  }

  async rejectChatRequest(chatId: string, req: IGetUserAuthInfoRequest) {
    const userId = this.getUserId(req);
    const chat = await this.chatModel.findOne({
      _id: new Types.ObjectId(chatId),
      requestedTo: new Types.ObjectId(userId),
      requestStatus: 'pending',
    });
    if (!chat) {
      throw new HttpException('Chat request not found', HttpStatus.NOT_FOUND);
    }

    await this.chatModel.updateOne(
      { _id: chat._id },
      { $set: { requestStatus: 'rejected' } },
    );

    return { success: true, message: 'Request rejected' };
  }

  /**
   * Mark chat as read for current user (set lastReadAt[userId] = now).
   */
  async markChatRead(chatId: string, req: IGetUserAuthInfoRequest) {
    const userId = this.getUserId(req);
    const chat = await this.chatModel.findById(chatId).lean();
    if (!chat) throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);

    const participants = (chat as any).users || [];
    const inChat = participants.some((p: any) => String(p) === userId || String(p._id) === userId);
    if (!inChat) {
      throw new HttpException('Not a participant', HttpStatus.FORBIDDEN);
    }

    const lastReadAt = (chat as any).lastReadAt && typeof (chat as any).lastReadAt === 'object'
      ? { ...(chat as any).lastReadAt }
      : {};
    lastReadAt[userId] = new Date();

    await this.chatModel.updateOne(
      { _id: new Types.ObjectId(chatId) },
      { $set: { lastReadAt } },
    );

    return { success: true, message: 'Marked as read' };
  }

  /**
   * Get messages for chat, paginated (oldest first for thread). Sender populated.
   */
  async getMessagesByChatId(
    chatId: string,
    req: IGetUserAuthInfoRequest,
    page = 1,
    limit = 50,
  ) {
    const userId = this.getUserId(req);
    const chat = await this.chatModel.findOne({
      _id: new Types.ObjectId(chatId),
      users: new Types.ObjectId(userId),
    });
    if (!chat) {
      throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
    }

    const skip = (Math.max(1, page) - 1) * Math.min(100, limit);
    const limitNum = Math.min(100, Math.max(1, limit));

    const messages = await this.messageModel
      .find({ chat: new Types.ObjectId(chatId), isDeleted: false })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate('sender', 'firstName lastName profileImage profileVideo')
      .lean()
      .exec();

    const total = await this.messageModel.countDocuments({
      chat: new Types.ObjectId(chatId),
      isDeleted: false,
    });

    return {
      success: true,
      data: {
        data: messages,
        total,
        page: Math.max(1, page),
        limit: limitNum,
      },
    };
  }

  /**
   * Create message and update chat.lastMessage, chat.lastMessageAt. Add chat to both users' chatIds if not already.
   */
  async createMessage(
    chatId: string,
    senderId: string,
    content: string,
    messageType: MessageType = 'text',
  ): Promise<ChatMessageDocument> {
    const chat = await this.chatModel.findById(chatId).lean();
    if (!chat) throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);

    const users = (chat as any).users || [];
    const isParticipant = users.some((u: any) => String(u) === senderId || String(u._id) === senderId);
    if (!isParticipant) {
      throw new HttpException('Not a participant', HttpStatus.FORBIDDEN);
    }

    const msg = await this.messageModel.create({
      chat: new Types.ObjectId(chatId),
      sender: new Types.ObjectId(senderId),
      content: content || '',
      messageType,
      isDeleted: false,
    });

    await this.chatModel.updateOne(
      { _id: new Types.ObjectId(chatId) },
      {
        $set: {
          lastMessage: msg._id,
          lastMessageAt: msg.createdAt || new Date(),
        },
      },
    );

    const userIds = users.map((u: any) => String(u._id || u));
    for (const uid of userIds) {
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(uid) },
        { $addToSet: { chatIds: new Types.ObjectId(chatId) } },
      );
    }

    return msg;
  }

  /** Get chat by id (for gateway to find receiver). */
  async getChatById(chatId: string): Promise<{ users: string[] } | null> {
    const chat = await this.chatModel.findById(chatId).select('users').lean().exec();
    if (!chat) return null;
    const users = ((chat as any).users || []).map((u: any) => String(u._id ?? u));
    return { users };
  }
}
