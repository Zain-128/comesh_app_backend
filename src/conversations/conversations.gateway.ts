import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConversationsService } from './conversations.service';
import { MessageType } from './schemas/message.schema';

const CONVERSATION_ROOM_PREFIX = 'conversation:';

export interface AuthenticatedSocket {
  id: string;
  userId: string;
  currentConversationId: string | null;
}

/** Supports multiple devices: one user can have multiple socket connections. */
@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class ConversationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** userId -> Set of socket IDs (multi-device) */
  private userSockets = new Map<string, Set<string>>();
  private socketToUserId = new Map<string, string>();
  /** socketId -> conversationId (per-device "in chat" state) */
  private socketToConversation = new Map<string, string | null>();
  /** userId -> conversationId for "receiver in this chat" (any device); updated on join/leave */
  private userCurrentConversation = new Map<string, string | null>();

  constructor(
    private jwtService: JwtService,
    private conversationsService: ConversationsService,
  ) {}

  async handleConnection(client: any) {
    try {
      const token =
        client.handshake?.headers?.authorization?.split?.(' ')?.[1] ||
        (client.handshake?.auth as any)?.token?.replace?.(/^Bearer\s+/i, '') ||
        (client.handshake?.auth as any)?.token;
      if (!token) return;
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      const userId = String(payload.sub ?? payload._id ?? payload.id ?? '');
      if (!userId) return;
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      this.socketToUserId.set(client.id, userId);
      (client as any).userId = userId;
      (client as any).currentConversationId = null;
    } catch {
      // ignore auth failure
    }
  }

  handleDisconnect(client: any) {
    const userId = (client as any).userId ?? this.socketToUserId.get(client.id);
    this.socketToConversation.delete(client.id);
    if (userId) {
      const set = this.userSockets.get(userId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) {
          this.userSockets.delete(userId);
          this.userCurrentConversation.delete(userId);
        } else {
          this.updateUserCurrentConversation(userId);
        }
      }
    }
    this.socketToUserId.delete(client.id);
  }

  /** Set userCurrentConversation to the conversation any of user's sockets is in (for unread skip). */
  private updateUserCurrentConversation(userId: string) {
    const socketIds = this.getUserSocketIds(userId);
    let inConversation: string | null = null;
    for (const sid of socketIds) {
      const cid = this.socketToConversation.get(sid);
      if (cid) {
        inConversation = cid;
        break;
      }
    }
    if (inConversation) this.userCurrentConversation.set(userId, inConversation);
    else this.userCurrentConversation.delete(userId);
  }

  private getUserId(client: any): string | null {
    return (client as any).userId ?? this.socketToUserId.get(client.id) ?? null;
  }

  /** Get all socket IDs for a user (for multi-device broadcast). userId can be string or object. */
  private getUserSocketIds(userId: string | any): string[] {
    const key = userId != null ? String(userId) : '';
    const set = this.userSockets.get(key);
    return set ? Array.from(set) : [];
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() payload: { conversationId: string },
    @ConnectedSocket() client: any,
  ) {
    const userId = this.getUserId(client);
    if (!userId || !payload?.conversationId) return;
    const convId = String(payload.conversationId);
    const room = CONVERSATION_ROOM_PREFIX + convId;
    await client.leaveAll();
    await client.join(room);
    (client as any).currentConversationId = convId;
    this.socketToConversation.set(client.id, convId);
    this.userCurrentConversation.set(userId, convId);
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(@ConnectedSocket() client: any) {
    const userId = this.getUserId(client);
    this.socketToConversation.delete(client.id);
    if (userId) this.updateUserCurrentConversation(userId);
    (client as any).currentConversationId = null;
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody()
    payload: {
      conversationId: string;
      receiverId: string;
      text?: string;
      content?: string;
      type?: 'text' | 'image';
    },
    @ConnectedSocket() client: any,
  ) {
    const senderId = this.getUserId(client);
    const content = (payload.content ?? payload.text ?? '').trim();
    const convId = payload?.conversationId != null ? String(payload.conversationId) : '';
    const receiverIdStr = payload?.receiverId != null ? String(payload.receiverId) : '';
    if (!senderId || !convId || !receiverIdStr || !content) {
      return { status: 'error', message: 'Invalid payload or unauthorized' };
    }
    const receiverInThisChat = this.userCurrentConversation.get(receiverIdStr) === convId;
    const type = payload.type === 'image' ? MessageType.IMAGE : MessageType.TEXT;
    try {
      const msg = await this.conversationsService.createMessage(
        convId,
        senderId,
        receiverIdStr,
        content,
        { type, skipUnreadForReceiver: receiverInThisChat },
      );
      const msgObj = msg.toObject ? msg.toObject() : (msg as any);
      msgObj.conversationId = String(msgObj.conversationId ?? convId);
      const room = CONVERSATION_ROOM_PREFIX + convId;
      const receiverSocketIds = this.getUserSocketIds(receiverIdStr);

      this.server.to(room).emit('new_message', msgObj);
      this.server.to(room).emit('receive_message', msgObj);
      receiverSocketIds.forEach((sid) => {
        this.server.to(sid).emit('new_message', msgObj);
        this.server.to(sid).emit('receive_message', msgObj);
      });
      if (receiverSocketIds.length > 0) {
        await this.conversationsService.setDelivered(String(msg._id));
        const senderSocketIds = this.getUserSocketIds(senderId);
        senderSocketIds.forEach((sid) =>
          this.server.to(sid).emit('message_delivered', { messageId: msg._id, conversationId: convId }),
        );
      }
      const updated = await this.conversationsService.getConversationById(convId);
      this.emitConversationUpdated(convId, updated);
      this.emitChatListUpdate(senderId, updated);
      this.emitChatListUpdate(receiverIdStr, updated);
      return { status: 'ok', data: msgObj };
    } catch (e: any) {
      return { status: 'error', message: e?.message ?? 'Failed to send' };
    }
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody() payload: { conversationId: string },
    @ConnectedSocket() client: any,
  ) {
    const userId = this.getUserId(client);
    if (!userId || !payload?.conversationId) return { status: 'error', message: 'Unauthorized or missing conversationId' };
    try {
      await this.conversationsService.markAsRead(payload.conversationId, userId);
      const room = CONVERSATION_ROOM_PREFIX + payload.conversationId;
      this.server.to(room).emit('message_read', { conversationId: payload.conversationId, userId });
      this.server.to(room).emit('message_seen', { conversationId: payload.conversationId, userId });
      const updated = await this.conversationsService.getConversationById(payload.conversationId);
      this.emitConversationUpdated(payload.conversationId, updated);
      this.emitChatListUpdate(userId, updated);
      (updated?.participants || []).forEach((p: any) => {
        const id = p?._id ?? p;
        if (id) this.emitChatListUpdate(String(id), updated);
      });
      return { status: 'ok', conversationId: payload.conversationId };
    } catch (e: any) {
      return { status: 'error', message: e?.message ?? 'Failed' };
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @MessageBody() payload: { conversationId: string },
    @ConnectedSocket() client: any,
  ) {
    const userId = this.getUserId(client);
    if (!userId || !payload?.conversationId) return;
    const room = CONVERSATION_ROOM_PREFIX + payload.conversationId;
    client.to(room).emit('user_typing', { conversationId: payload.conversationId, userId, isTyping: true });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @MessageBody() payload: { conversationId: string },
    @ConnectedSocket() client: any,
  ) {
    const userId = this.getUserId(client);
    if (!userId || !payload?.conversationId) return;
    const room = CONVERSATION_ROOM_PREFIX + payload.conversationId;
    client.to(room).emit('user_typing', { conversationId: payload.conversationId, userId, isTyping: false });
  }

  private emitConversationUpdated(conversationId: string, conv: any) {
    if (!conv) return;
    const room = CONVERSATION_ROOM_PREFIX + conversationId;
    this.server.to(room).emit('conversation_updated', conv);
    this.server.to(room).emit('chat_list_update', conv);
  }

  /** Emit chat_list_update to a user (so chat list moves to top / unread updates) */
  private emitChatListUpdate(userId: string, conv: any) {
    if (!conv) return;
    const socketIds = this.getUserSocketIds(userId);
    socketIds.forEach((sid) => {
      this.server.to(sid).emit('conversation_updated', conv);
      this.server.to(sid).emit('chat_list_update', conv);
    });
  }

  async notifyNewMessageDelivered(messageId: string, conversationId: string, receiverId: string) {
    const receiverInChat = this.userCurrentConversation.get(receiverId) === conversationId;
    if (!receiverInChat) return;
    const receiverSocketIds = this.getUserSocketIds(receiverId);
    receiverSocketIds.forEach((sid) =>
      this.server.to(sid).emit('message_delivered', { messageId, conversationId }),
    );
  }
}
