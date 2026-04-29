import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { ChatService } from './chat.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: number;
    roleId: number;
    sessionId: number;
  };
}

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string, {
        secret: this.configService.getOrThrow('auth.secret', { infer: true }),
      });

      client.data.userId = payload.id;
      client.data.roleId = payload.role?.id;
      client.data.sessionId = payload.sessionId;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect() {}

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId?: number },
  ) {
    const isAdmin = client.data.roleId === 1;
    let targetUserId: number;

    if (isAdmin && data?.userId) {
      targetUserId = data.userId;
    } else {
      targetUserId = client.data.userId;
    }

    const room = await this.chatService.getOrCreateRoom(targetUserId);
    const roomName = `chat_room_${room.id}`;

    await client.join(roomName);

    void this.chatService.markAsRead(room.id, client.data.userId);

    client.emit('joinedRoom', { roomId: room.id, userId: targetUserId });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatRoomId: number; message: string },
  ) {
    if (!data?.chatRoomId || !data?.message) {
      client.emit('error', { message: 'chatRoomId and message are required' });
      return;
    }

    const room = await this.chatService.getRoomById(data.chatRoomId);
    if (!room) {
      client.emit('error', { message: 'Room not found' });
      return;
    }

    const isAdmin = client.data.roleId === 1;
    const isOwner = room.userId === client.data.userId;
    if (!isAdmin && !isOwner) {
      client.emit('error', { message: 'Access denied' });
      return;
    }

    const message = await this.chatService.sendMessage(
      data.chatRoomId,
      client.data.userId,
      data.message,
    );

    const roomName = `chat_room_${data.chatRoomId}`;
    this.server.to(roomName).emit('newMessage', message);
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatRoomId: number; page?: number; limit?: number },
  ) {
    if (!data?.chatRoomId) {
      client.emit('error', { message: 'chatRoomId is required' });
      return;
    }

    const room = await this.chatService.getRoomById(data.chatRoomId);
    if (!room) {
      client.emit('error', { message: 'Room not found' });
      return;
    }

    const isAdmin = client.data.roleId === 1;
    const isOwner = room.userId === client.data.userId;
    if (!isAdmin && !isOwner) {
      client.emit('error', { message: 'Access denied' });
      return;
    }

    const messages = await this.chatService.getMessages(
      data.chatRoomId,
      data.page || 1,
      data.limit || 50,
    );

    client.emit('messages', { chatRoomId: data.chatRoomId, messages });
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatRoomId: number },
  ) {
    if (!data?.chatRoomId) return;

    await this.chatService.markAsRead(data.chatRoomId, client.data.userId);
    client.emit('markedAsRead', { chatRoomId: data.chatRoomId });
  }

  @SubscribeMessage('getRooms')
  async handleGetRooms(@ConnectedSocket() client: AuthenticatedSocket) {
    const isAdmin = client.data.roleId === 1;
    if (!isAdmin) {
      client.emit('error', { message: 'Admin only' });
      return;
    }

    const rooms = await this.chatService.getAllRooms();
    client.emit('rooms', rooms);
  }
}
