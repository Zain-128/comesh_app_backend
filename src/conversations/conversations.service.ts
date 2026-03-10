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
} from './schemas/message.schema';
import { IGetUserAuthInfoRequest } from '../interfaces';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(CONVERSATION_SCHEMA_NAME)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(CONVERSATION_MESSAGE_SCHEMA_NAME)
    private messageModel: Model<ConversationMessageDocument>,
  ) {}

  private getUserId(req: IGetUserAuthInfoRequest): string {
    const id = req.user?._id ?? req.user?.sub ?? req.user?.id;
    if (!id) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return String(id);
  }

  /** GET /conversations - chat list with unread counts */
  async getConversations(req: IGetUserAuthInfoRequest, limit = 50, page = 1) {
    const userId = this.getUserId(req);
    const skip = (Math.max(1, page) - 1) * Math.min(100, limit);
    const limitNum = Math.min(100, Math.max(1, limit));

    const conversations = await this.conversationModel
      .find({
        participants: new Types.ObjectId(userId),
        isDeleted: { $ne: true },
      })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('participants', 'firstName lastName profileImage email')
      .lean()
      .exec();

    const total = await this.conversationModel.countDocuments({
      participants: new Types.ObjectId(userId),
      isDeleted: { $ne: true },
    });

    const list = conversations.map((conv: any) => {
      const other = conv.participants.find(
        (p: any) => String(p._id) !== String(userId),
      );
      const unreadEntry = (conv.unreadCounts || []).find(
        (u: any) => String(u.userId) === String(userId),
      );
      const unreadCount = unreadEntry?.count ?? 0;
      return {
        ...conv,
        otherUser: other,
        unreadCount,
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

  /** GET /messages/:conversationId - paginated messages */
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
      .populate('senderId', 'firstName lastName profileImage')
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

  /** POST /start-conversation - create or get existing 1-to-1 conversation */
  async startConversation(
    otherUserId: string,
    req: IGetUserAuthInfoRequest,
  ): Promise<{ success: boolean; data: ConversationDocument }> {
    const userId = this.getUserId(req);
    const sorted = [userId, otherUserId].sort();
    let conv = await this.conversationModel
      .findOne({
        participants: { $all: sorted.map((id) => new Types.ObjectId(id)) },
        $expr: { $eq: [{ $size: '$participants' }, 2] },
        isDeleted: { $ne: true },
      })
      .populate('participants', 'firstName lastName profileImage')
      .lean()
      .exec();

    if (conv) {
      return {
        success: true,
        data: conv as any,
      };
    }

    const newConv = await this.conversationModel.create({
      participants: sorted.map((id) => new Types.ObjectId(id)),
      lastMessage: '',
      lastMessageAt: null,
      unreadCounts: sorted.map((id) => ({ userId: new Types.ObjectId(id), count: 0 })),
    });

    const populated = await this.conversationModel
      .findById(newConv._id)
      .populate('participants', 'firstName lastName profileImage')
      .lean()
      .exec();

    return { success: true, data: populated as any };
  }

  /** Create message (used by gateway and fallback API). skipUnreadForReceiver: true when receiver is currently in this chat screen. */
  async createMessage(
    conversationId: string,
    senderId: string,
    receiverId: string,
    text: string,
    skipUnreadForReceiver = false,
  ): Promise<ConversationMessageDocument> {
    const msg = await this.messageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      text,
      status: MessageStatus.SENT,
      readAt: null,
    });

    if (skipUnreadForReceiver) {
      await this.conversationModel.updateOne(
        { _id: new Types.ObjectId(conversationId) },
        { $set: { lastMessage: text, lastMessageAt: new Date() } },
      ).exec();
      return msg;
    }

    // Update last message and increment only receiver's unread count
    await this.conversationModel
      .updateOne(
        { _id: new Types.ObjectId(conversationId) },
        {
          $set: { lastMessage: text, lastMessageAt: new Date() },
          $inc: { 'unreadCounts.$[elem].count': 1 },
        },
        { arrayFilters: [{ 'elem.userId': new Types.ObjectId(receiverId) }] },
      )
      .exec();

    const conv = await this.conversationModel.findById(conversationId).lean();
    const hasReceiverEntry = (conv?.unreadCounts || []).some(
      (u: any) => String(u.userId) === String(receiverId),
    );
    if (!hasReceiverEntry) {
      await this.conversationModel.updateOne(
        { _id: new Types.ObjectId(conversationId) },
        {
          $set: { lastMessage: text, lastMessageAt: new Date() },
          $push: { unreadCounts: { userId: new Types.ObjectId(receiverId), count: 1 } },
        },
      ).exec();
    }

    return msg;
  }

  /** Mark conversation as read for a user (reset unread, set message status READ) */
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        receiverId: new Types.ObjectId(userId),
        status: { $ne: MessageStatus.READ },
      },
      { $set: { status: MessageStatus.READ, readAt: new Date() } },
    );

    await this.conversationModel.updateOne(
      { _id: new Types.ObjectId(conversationId), 'unreadCounts.userId': new Types.ObjectId(userId) },
      { $set: { 'unreadCounts.$.count': 0 } },
    );
  }

  /** Set message status to DELIVERED (when receiver is connected) */
  async setDelivered(messageId: string): Promise<ConversationMessageDocument | null> {
    const msg = await this.messageModel.findByIdAndUpdate(
      messageId,
      { $set: { status: MessageStatus.DELIVERED } },
      { new: true },
    ).lean();
    return msg as any;
  }

  /** Get conversation by ID (for gateway) */
  async getConversationById(conversationId: string): Promise<ConversationDocument | null> {
    return this.conversationModel
      .findById(conversationId)
      .populate('participants', 'firstName lastName profileImage')
      .lean() as any;
  }

  /** Increment unread only for receiver and only if not already in that conversation (caller checks "in chat") */
  async incrementUnread(conversationId: string, receiverId: string): Promise<void> {
    const conv = await this.conversationModel.findById(conversationId).lean();
    if (!conv) return;
    const hasEntry = (conv.unreadCounts || []).some(
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
