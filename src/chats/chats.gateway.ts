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
            const userId = String(payload.sub ?? payload._id ?? payload.id ?? '');

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
            const savedMessage = await this.messagesService.create({
                to: payload.to,
                from: senderId,
                chatId: payload.chatId,
                message: payload.message,
                messageType: payload.type as any || 'TEXT',
                mediaFile: payload.mediaFile || null,
                isRead: false
            } as any); // Type casting for simplicity if DTO differs slightly

            // 2. Emit to Receiver
            const receiverSocketId = this.connectedUsers.get(payload.to);
            if (receiverSocketId) {
                this.server.to(receiverSocketId).emit('receiveMessage', savedMessage.data);
            }

            // 3. Send Push Notification ALWAYS (regardless of connection status)
            // The frontend handles foreground filtering if needed.
            try {
                const receiver = await this.userModel.findById(payload.to).select('deviceToken pushNotificationEnabled').lean();

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
