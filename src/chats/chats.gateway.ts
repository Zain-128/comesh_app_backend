import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../messages/messages.service';

import { FCMMessagingService } from '../fcm/fcm.service';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../users/user.schema';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // Map: userId -> socketId
    private connectedUsers = new Map<string, string>();

    constructor(
        private jwtService: JwtService,
        @Inject(forwardRef(() => MessagesService))
        private messagesService: MessagesService,
        @InjectModel('User')
        private userModel: Model<UserDocument>,
        private fcmService: FCMMessagingService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            // Match `chat.gateway.ts` + React Native socket.io (often `auth.token`, not headers)
            let raw: string | undefined =
                client.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '').trim() ||
                (client.handshake?.auth as any)?.token?.replace?.(/^Bearer\s+/i, '') ||
                (client.handshake?.auth as any)?.token;
            if (typeof raw === 'string' && raw.startsWith('Bearer ')) {
                raw = raw.replace(/^Bearer\s+/i, '').trim();
            }
            const token = raw;
            if (!token) {
                return;
            }

            const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
            /** Login JWT uses `_id`, not `sub`. */
            const rawId = (payload as { _id?: unknown; sub?: unknown; id?: unknown })._id ??
                (payload as { sub?: unknown }).sub ??
                (payload as { id?: unknown }).id;
            const userId = rawId != null && rawId !== '' ? String(rawId) : '';

            if (userId) {
                this.connectedUsers.set(userId, client.id);
                console.log(`User connected: ${userId} (${client.id})`);
            }
        } catch (error) {
            console.error('Connection auth failed', error.message);
        }
    }

    handleDisconnect(client: Socket) {
        for (const [userId, socketId] of this.connectedUsers.entries()) {
            if (socketId === client.id) {
                this.connectedUsers.delete(userId);
                console.log(`User disconnected: ${userId}`);
                break;
            }
        }
    }

    private chatRoom(chatId: string) {
        return `chat:${String(chatId)}`;
    }

    /**
     * REST POST /messages saves via HTTP; emit so clients see new messages in real time.
     * Uses Socket.IO room (after join-chat) + direct socket for receiver (always).
     */
    emitMessageToReceiver(saved: { data?: unknown } | unknown) {
        const doc: any =
            saved && typeof saved === 'object' && 'data' in (saved as object)
                ? (saved as { data: unknown }).data
                : saved;
        if (!doc) return;
        const plain =
            doc && typeof (doc as { toObject?: () => unknown }).toObject === 'function'
                ? (doc as { toObject: () => Record<string, unknown> }).toObject()
                : { ...doc };
        const toId =
            plain.to != null
                ? String((plain.to as { toString?: () => string })?.toString?.() ?? plain.to)
                : '';
        if (!toId) return;
        const chatIdRaw = plain.chatId;
        const chatIdStr =
            chatIdRaw != null ? String((chatIdRaw as { toString?: () => string })?.toString?.() ?? chatIdRaw) : '';

        const events = ['receiveMessage', 'receive_message', 'new-message', 'new_message'] as const;
        for (const ev of events) {
            if (chatIdStr) {
                this.server.to(this.chatRoom(chatIdStr)).emit(ev, plain);
            }
            const socketId = this.connectedUsers.get(toId);
            if (socketId) {
                this.server.to(socketId).emit(ev, plain);
            }
        }
    }

    /** Tell both participants to refetch chat list (last message + unread). */
    emitChatListRefresh(chatId: string, participantUserIds: string[]) {
        const cid = String(chatId);
        const payload = { chatId: cid };
        const seen = new Set<string>();
        for (const uid of participantUserIds) {
            const id = uid != null ? String(uid) : '';
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const socketId = this.connectedUsers.get(id);
            if (socketId) {
                this.server.to(socketId).emit('chat-updated', payload);
            }
        }
    }

    @SubscribeMessage('join-chat')
    handleJoinChat(@MessageBody() body: string | { chatId?: string }, @ConnectedSocket() client: Socket) {
        const chatId =
            typeof body === 'string'
                ? body
                : body && typeof body === 'object'
                  ? body.chatId ?? (body as { chat?: string }).chat
                  : '';
        if (!chatId) return;
        void client.join(this.chatRoom(String(chatId)));
    }

    @SubscribeMessage('leave-chat')
    handleLeaveChat(@MessageBody() body: string | { chatId?: string }, @ConnectedSocket() client: Socket) {
        const chatId =
            typeof body === 'string'
                ? body
                : body && typeof body === 'object'
                  ? body.chatId ?? (body as { chat?: string }).chat
                  : '';
        if (!chatId) return;
        void client.leave(this.chatRoom(String(chatId)));
    }

    @SubscribeMessage('sendMessage')
    async handleSendMessage(
        @MessageBody() payload: { to: string; message: string; chatId: string; type?: string; mediaFile?: any },
        @ConnectedSocket() client: Socket,
    ) {
        const senderId = [...this.connectedUsers.entries()].find(
            ([_, socketId]) => socketId === client.id,
        )?.[0];

        if (!senderId) {
            return { status: 'error', message: 'Unauthorized' };
        }

        // 1. Save to DB using MessagesService
        // We need to construct the DTO
        try {
            const toUserId = (payload as { to?: string; receiverId?: string }).to ??
                (payload as { receiverId?: string }).receiverId;
            const savedMessage = await this.messagesService.create({
                to: toUserId,
                from: senderId,
                chatId: payload.chatId,
                message: payload.message ?? (payload as { content?: string }).content ?? '',
                messageType: (payload.type as any) || (payload as { messageType?: string }).messageType || 'TEXT',
                mediaFile: payload.mediaFile || null,
                isRead: false
            } as any); // Type casting for simplicity if DTO differs slightly

            // 2. Emit to Receiver (same shape as REST path)
            this.emitMessageToReceiver(savedMessage);

            // 3. Send Push Notification ALWAYS (regardless of connection status)
            // The frontend handles foreground filtering if needed.
            try {
                const receiver = await this.userModel.findById(toUserId).select('deviceToken pushNotificationEnabled').lean();

                if (receiver && receiver.deviceToken && receiver.pushNotificationEnabled !== false) {
                    await this.fcmService.sendMessageToTokens({
                        tokens: [receiver.deviceToken],
                        title: 'New Message', // Ideally sender name
                        body: payload.message,
                        payload: {
                            type: 'CHAT_MESSAGE',
                            chatId: payload.chatId,
                            messageId: savedMessage.data?._id?.toString() || ''
                        }
                    });
                }
            } catch (pushError) {
                console.error('Failed to send push notification', pushError);
            }

            // Also emit back to sender (optional, but good for confirmation/optimistic UI updates)
            return { status: 'ok', data: savedMessage.data };

        } catch (error) {
            console.error('Error sending message:', error);
            return { status: 'error', message: error.message };
        }
    }
    @SubscribeMessage('markAsRead')
    async handleMarkAsRead(
        @MessageBody() payload: { chatId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const userId = [...this.connectedUsers.entries()].find(
            ([_, socketId]) => socketId === client.id,
        )?.[0];

        if (!userId) {
            return { status: 'error', message: 'Unauthorized' };
        }

        await this.messagesService.markAsRead(payload.chatId, userId);

        return { status: 'ok', chatId: payload.chatId };
    }
}
