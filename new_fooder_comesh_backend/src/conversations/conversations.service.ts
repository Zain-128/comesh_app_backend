import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
  CONVERSATION_SCHEMA_NAME,
} from './schemas/conversation.schema';
import {
  ConversationMessage,
  ConversationMessageDocument,
  CONVERSATION_MESSAGE_SCHEMA_NAME,
  MessageStatus,
  MessageType,
} from './schemas/message.schema';
import { IGetUserAuthInfoRequest } from '../interfaces';

/** Shape of user when only blockUsers is selected (for block checks) */
interface UserBlockUsers {
  blockUsers?: string[];
}

/** Deterministic chatId: sorted user ids joined (userA_userB) */
export function getDeterministicChatId(userId1: string, userId2: string): string {
  const [a, b] = [String(userId1), String(userId2)].sort();
  return `${a}_${b}`;
}

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(CONVERSATION_SCHEMA_NAME)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(CONVERSATION_MESSAGE_SCHEMA_NAME)
    private messageModel: Model<ConversationMessageDocument>,
    @InjectModel('User')
    private userModel: Model<any>,
  ) {}

  private getUserId(req: IGetUserAuthInfoRequest): string {
    const id = req.user?._id ?? req.user?.sub ?? req.user?.id;
    if (!id) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return String(id);
  }

  /** GET /conversations - chat list sorted by updatedAt, with unread counts */
  async getConversations(req: IGetUserAuthInfoRequest, limit = 50, page = 1) {
    const userId = this.getUserId(req);
    const skip = (Math.max(1, page) - 1) * Math.min(100, limit);
    const limitNum = Math.min(100, Math.max(1, limit));

    const currentUser = (await this.userModel.findById(userId).select('blockUsers').lean().exec()) as UserBlockUsers | null;
    const blockedIds = (currentUser?.blockUsers || []).map((id: any) => new Types.ObjectId(id));

    const pipeline: any[] = [
      {
        $match: {
          participants: new Types.ObjectId(userId),
          isDeleted: { $ne: true },
        },
      },
      {
        $addFields: {
          otherParticipantId: {
            $arrayElemAt: [
              { $filter: { input: '$participants', as: 'p', cond: { $ne: ['$$p', new Types.ObjectId(userId)] } } },
              0,
            ],
          },
        },
      },
    ];
    if (blockedIds.length > 0) {
      pipeline.push({ $match: { otherParticipantId: { $nin: blockedIds } } });
    }
    pipeline.push(
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participants',
          pipeline: [{ $project: { firstName: 1, lastName: 1, profileImage: 1, profileVideo: 1, email: 1 } }],
        },
      },
    );

    const conversations = await this.conversationModel.aggregate(pipeline).exec();

    const countMatch: any = {
      participants: new Types.ObjectId(userId),
      isDeleted: { $ne: true },
    };
    let total = await this.conversationModel.countDocuments(countMatch).exec();
    if (blockedIds.length > 0) {
      const countPipeline = [
        { $match: countMatch },
        {
          $addFields: {
            otherParticipantId: {
              $arrayElemAt: [
                { $filter: { input: '$participants', as: 'p', cond: { $ne: ['$$p', new Types.ObjectId(userId)] } } },
                0,
              ],
            },
          },
        },
        { $match: { otherParticipantId: { $nin: blockedIds } } },
        { $count: 'n' },
      ];
      const countResult = await this.conversationModel.aggregate(countPipeline).exec();
      total = countResult[0]?.n ?? 0;
    }

    const list = conversations.map((conv: any) => {
      const other = conv.participants?.find((p: any) => String(p._id) !== String(userId));
      // Prefer unreadCount object, fallback to unreadCounts array
      let unreadCount = 0;
      if (conv.unreadCount && typeof conv.unreadCount === 'object' && conv.unreadCount[String(userId)] !== undefined) {
        unreadCount = Number(conv.unreadCount[String(userId)]) || 0;
      } else {
        const unreadEntry = (conv.unreadCounts || []).find((u: any) => String(u.userId) === String(userId));
        unreadCount = unreadEntry?.count ?? 0;
      }
      if (conv.lastMessageSenderId && String(conv.lastMessageSenderId) === String(userId)) {
        unreadCount = 0;
      }
      return {
        ...conv,
        chatId: conv.chatId || getDeterministicChatId(conv.participants?.[0]?.toString() || '', conv.participants?.[1]?.toString() || ''),
        otherUser: other,
        users: conv.participants,
        unreadCount,
        updatedAt: conv.updatedAt || conv.lastMessageAt,
      };
    });

    return {
      success: true,
      data: {
        data: list,
        total,
        page: Math.max(1, page),
        limit: limitNum,
      },
    };
  }

  /** GET /messages/:conversationId - paginated messages; marks as read when user opens chat (call markAsRead separately from client) */
  async getMessages(
    conversationId: string,
    req: IGetUserAuthInfoRequest,
    page = 1,
    limit = 50,
  ) {
    const userId = this.getUserId(req);
    const conv = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      participants: new Types.ObjectId(userId),
      isDeleted: { $ne: true },
    });
    if (!conv) {
      throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND);
    }

    const skip = (Math.max(1, page) - 1) * Math.min(100, limit);
    const limitNum = Math.min(100, Math.max(1, limit));

    const messages = await this.messageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('senderId', 'firstName lastName profileImage profileVideo')
      .lean()
      .exec();

    const total = await this.messageModel.countDocuments({
      conversationId: new Types.ObjectId(conversationId),
    });

    return {
      success: true,
      data: {
        data: messages.reverse(),
        total,
        page: Math.max(1, page),
        limit: limitNum,
      },
    };
  }

  /** POST /start-conversation - create or get by deterministic chatId */
  async startConversation(
    otherUserId: string,
    req: IGetUserAuthInfoRequest,
  ): Promise<{ success: boolean; data: any }> {
    const userId = this.getUserId(req);
    const currentUser = (await this.userModel.findById(userId).select('blockUsers').lean().exec()) as UserBlockUsers | null;
    const blockedByMe = new Set(((currentUser?.blockUsers) || []).map((id: any) => String(id)));
    if (blockedByMe.has(String(otherUserId))) {
      throw new HttpException('Cannot start conversation with this user', HttpStatus.FORBIDDEN);
    }
    const otherUser = (await this.userModel.findById(otherUserId).select('blockUsers').lean().exec()) as UserBlockUsers | null;
    const blockedByThem = new Set(((otherUser?.blockUsers) || []).map((id: any) => String(id)));
    if (blockedByThem.has(String(userId))) {
      throw new HttpException('Cannot start conversation with this user', HttpStatus.FORBIDDEN);
    }

    const chatId = getDeterministicChatId(userId, otherUserId);
    const sorted = [userId, otherUserId].sort();
    let conv = await this.conversationModel
      .findOne({
        $or: [
          { chatId },
          {
            participants: { $all: sorted.map((id) => new Types.ObjectId(id)) },
            $expr: { $eq: [{ $size: '$participants' }, 2] },
          },
        ],
        isDeleted: { $ne: true },
      })
      .populate('participants', 'firstName lastName profileImage profileVideo')
      .lean()
      .exec();

    if (conv) {
      const convObj = conv as any;
      if (!convObj.chatId) {
        await this.conversationModel.updateOne(
          { _id: conv._id },
          { $set: { chatId } },
        ).exec();
        convObj.chatId = chatId;
      }
      return { success: true, data: convObj };
    }

    const unreadCount: Record<string, number> = { [userId]: 0, [otherUserId]: 0 };
    const newConv = await this.conversationModel.create({
      chatId,
      participants: sorted.map((id) => new Types.ObjectId(id)),
      lastMessage: '',
      lastMessageAt: null,
      lastMessageId: null,
      lastMessageSenderId: null,
      unreadCount,
      unreadCounts: sorted.map((id) => ({ userId: new Types.ObjectId(id), count: 0 })),
    });

    const populated = await this.conversationModel
      .findById(newConv._id)
      .populate('participants', 'firstName lastName profileImage profileVideo')
      .lean()
      .exec();

    return { success: true, data: { ...populated, chatId } as any };
  }

  /** Create message (text or image). content: text or image URL. */
  async createMessage(
    conversationId: string,
    senderId: string,
    receiverId: string,
    content: string,
    options: { type?: MessageType; skipUnreadForReceiver?: boolean } = {},
  ): Promise<ConversationMessageDocument> {
    const type = options.type || MessageType.TEXT;
    const skipUnreadForReceiver = options.skipUnreadForReceiver ?? false;
    const text = type === MessageType.TEXT ? content : (content || '[Photo]');

    const conv = await this.conversationModel.findById(conversationId).lean();
    const chatId = (conv as any)?.chatId || getDeterministicChatId(senderId, receiverId);

    const msg = await this.messageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      chatId,
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      content: content || text,
      type,
      text,
      status: MessageStatus.SENT,
      readAt: null,
    });

    const lastMessagePreview = type === MessageType.IMAGE ? '[Photo]' : (content || '').slice(0, 200);
    const now = new Date();
    const lastMessageUpdate: any = {
      lastMessage: lastMessagePreview,
      lastMessageType: type === MessageType.IMAGE ? 'image' : 'text',
      lastMessageAt: now,
      lastMessageSenderId: new Types.ObjectId(senderId),
      lastMessageId: msg._id,
      updatedAt: now, // Required so chat list sort by updatedAt moves this chat to top
    };

    if (skipUnreadForReceiver) {
      await this.conversationModel.updateOne(
        { _id: new Types.ObjectId(conversationId) },
        { $set: lastMessageUpdate },
      ).exec();
      return msg;
    }

    // Increment unread for receiver: use unreadCount object
    const convDoc = await this.conversationModel.findById(conversationId).lean();
    const currentUnread = (convDoc as any)?.unreadCount && typeof (convDoc as any).unreadCount === 'object'
      ? { ...(convDoc as any).unreadCount }
      : {};
    const receiverKey = String(receiverId);
    currentUnread[receiverKey] = (currentUnread[receiverKey] || 0) + 1;

    await this.conversationModel.updateOne(
      { _id: new Types.ObjectId(conversationId) },
      {
        $set: {
          ...lastMessageUpdate,
          unreadCount: currentUnread,
        },
      },
    ).exec();

    // Legacy unreadCounts array: ensure receiver entry and increment
    const hasReceiverEntry = ((convDoc as any)?.unreadCounts || []).some(
      (u: any) => String(u.userId) === String(receiverId),
    );
    if (!hasReceiverEntry) {
      await this.conversationModel.updateOne(
        { _id: new Types.ObjectId(conversationId) },
        { $push: { unreadCounts: { userId: new Types.ObjectId(receiverId), count: 1 } } },
      ).exec();
    } else {
      await this.conversationModel.updateOne(
        { _id: new Types.ObjectId(conversationId), 'unreadCounts.userId': new Types.ObjectId(receiverId) },
        { $inc: { 'unreadCounts.$.count': 1 } },
      ).exec();
    }

    return msg;
  }

  /** Mark conversation as read for user; reset unread to 0; set message status to SEEN */
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    const convId = new Types.ObjectId(conversationId);
    const userObjId = new Types.ObjectId(userId);

    await this.messageModel.updateMany(
      {
        conversationId: convId,
        receiverId: userObjId,
        status: { $ne: MessageStatus.SEEN },
      },
      { $set: { status: MessageStatus.SEEN, readAt: new Date() } },
    );

    const conv = await this.conversationModel.findById(convId).lean();
    if (!conv) return;
    const currentUnread = (conv as any)?.unreadCount && typeof (conv as any).unreadCount === 'object'
      ? { ...(conv as any).unreadCount }
      : {};
    currentUnread[String(userId)] = 0;

    await this.conversationModel.updateOne(
      { _id: convId },
      { $set: { unreadCount: currentUnread } },
    ).exec();

    const hasEntry = ((conv as any).unreadCounts || []).some(
      (u: any) => String(u.userId) === String(userId),
    );
    if (hasEntry) {
      await this.conversationModel.updateOne(
        { _id: convId, 'unreadCounts.userId': userObjId },
        { $set: { 'unreadCounts.$.count': 0 } },
      ).exec();
    } else {
      await this.conversationModel.updateOne(
        { _id: convId },
        { $push: { unreadCounts: { userId: userObjId, count: 0 } } },
      ).exec();
    }
  }

  /** Set message status to DELIVERED */
  async setDelivered(messageId: string): Promise<ConversationMessageDocument | null> {
    const msg = await this.messageModel.findByIdAndUpdate(
      messageId,
      { $set: { status: MessageStatus.DELIVERED } },
      { new: true },
    ).lean();
    return msg as any;
  }

  /** Get conversation by ID for gateway (with participants populated) */
  async getConversationById(conversationId: string): Promise<any> {
    const conv = await this.conversationModel
      .findById(conversationId)
      .populate('participants', 'firstName lastName profileImage profileVideo')
      .lean()
      .exec();
    if (!conv) return null;
    const c = conv as any;
    const chatId = c.chatId || (c.participants?.length === 2
      ? getDeterministicChatId(String(c.participants[0]._id), String(c.participants[1]._id))
      : null);
    return { ...c, chatId };
  }

  /** Increment unread for receiver (used when receiver not in chat) */
  async incrementUnread(conversationId: string, receiverId: string): Promise<void> {
    const conv = await this.conversationModel.findById(conversationId).lean();
    if (!conv) return;
    const currentUnread = (conv as any)?.unreadCount && typeof (conv as any).unreadCount === 'object'
      ? { ...(conv as any).unreadCount }
      : {};
    currentUnread[String(receiverId)] = (currentUnread[String(receiverId)] || 0) + 1;
    await this.conversationModel.updateOne(
      { _id: new Types.ObjectId(conversationId) },
      { $set: { unreadCount: currentUnread } },
    ).exec();
    const hasEntry = ((conv as any).unreadCounts || []).some(
      (u: any) => String(u.userId) === String(receiverId),
    );
    if (hasEntry) {
      await this.conversationModel.updateOne(
        { _id: new Types.ObjectId(conversationId), 'unreadCounts.userId': new Types.ObjectId(receiverId) },
        { $inc: { 'unreadCounts.$.count': 1 } },
      ).exec();
    } else {
      await this.conversationModel.updateOne(
        { _id: new Types.ObjectId(conversationId) },
        { $push: { unreadCounts: { userId: new Types.ObjectId(receiverId), count: 1 } } },
      ).exec();
    }
  }

  /** Soft delete conversation */
  async deleteConversation(conversationId: string, req: IGetUserAuthInfoRequest): Promise<void> {
    const userId = this.getUserId(req);
    await this.conversationModel.updateOne(
      { _id: new Types.ObjectId(conversationId), participants: new Types.ObjectId(userId) },
      { $set: { isDeleted: true } },
    );
  }
}
