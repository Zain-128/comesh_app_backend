import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private userSockets = new Map<string, Set<string>>();
  private socketToUser = new Map<string, string>();

  constructor(private jwtService: JwtService) {}

  handleConnection(client: any) {
    try {
      const token =
        client.handshake?.headers?.authorization?.replace?.(/^Bearer\s+/i, '') ||
        (client.handshake?.auth as any)?.token?.replace?.(/^Bearer\s+/i, '') ||
        (client.handshake?.auth as any)?.token;
      if (!token) return;
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      const userId = String(payload.sub ?? payload._id ?? payload.id ?? '');
      if (!userId) return;
      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);
      this.socketToUser.set(client.id, userId);
      (client as any).userId = userId;
    } catch {
      // auth failed
    }
  }

  handleDisconnect(client: any) {
    const userId = (client as any).userId ?? this.socketToUser.get(client.id);
    this.socketToUser.delete(client.id);
    if (userId) {
      const set = this.userSockets.get(userId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) this.userSockets.delete(userId);
      }
    }
  }

  emitToUser(userId: string, event: string, payload: any) {
    const socketIds = this.userSockets.get(String(userId));
    if (!socketIds) return;
    socketIds.forEach((sid) => {
      this.server.to(sid).emit(event, payload);
    });
  }
}
