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
import { ChatAutomationsService } from '../chat-automations/chat-automations.service';

/**
 * Every connected admin socket (#032). A customer who opens a conversation after
 * an admin subscribed to all rooms was never heard by that admin — no badge, no
 * notification — until the chat page was reloaded.
 */
export const ADMINS_CHANNEL = 'admins';

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
    private readonly chatAutomationsService: ChatAutomationsService,
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

      if (client.data.roleId === 1) {
        void client.join(ADMINS_CHANNEL);
      }
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

    if (isAdmin) {
      // The admin opened the conversation: the customer's messages are seen.
      void this.chatService.markAsRead(room.id, client.data.userId);
    } else {
      // The storefront joins on every page, chat open or not: the admin's
      // messages have reached the customer, not been seen (vande-1411 #035).
      // "Seen" comes from the customer's own markAsRead, sent when the chat
      // window is open.
      void this.markDeliveredAndTell(room.id, roomName, client.data.userId);
    }

    client.emit('joinedRoom', { roomId: room.id, userId: targetUserId });

    if (!isAdmin) {
      // Bring every connected admin into this conversation, and tell them the
      // room list changed, so a brand-new chat reaches the badge (#032).
      this.server.in(ADMINS_CHANNEL).socketsJoin(roomName);
      this.server.to(ADMINS_CHANNEL).emit('roomsChanged');

      // Trigger 1: Send welcome message when a non-admin user joins a room
      void this.sendWelcomeMessage(room.id, roomName);
    }
  }

  /**
   * Trigger Logic 1: Send automated welcome message on user join.
   * Only sends if the room has no messages yet (first time user opens chat).
   */
  private async sendWelcomeMessage(
    chatRoomId: number,
    roomName: string,
  ): Promise<void> {
    try {
      // Only send welcome if room is brand new (no messages yet)
      const existingMessages = await this.chatService.getMessages(
        chatRoomId,
        1,
        1,
      );
      if (existingMessages.length > 0) return;

      const welcomeMsg = await this.chatAutomationsService.getWelcomeMessage();
      if (!welcomeMsg) return;

      const botMessage = await this.chatService.sendMessage(
        chatRoomId,
        null, // senderId=null represents the system/bot
        welcomeMsg,
      );
      this.server.to(roomName).emit('newMessage', botMessage);
    } catch {
      // Silently ignore automation failures
    }
  }

  /**
   * React to a message (vande-1411 #037): anyone who may write in the room —
   * its customer, or an admin. Everyone in the room sees the new reactions.
   */
  @SubscribeMessage('react')
  async handleReact(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: number; emoji: string | null },
  ) {
    if (!data?.messageId) return;
    const message = await this.chatService.getMessageById(
      Number(data.messageId),
    );
    if (!message) return;
    const room = await this.chatService.getRoomById(message.chatRoomId);
    if (!room) return;
    const isAdmin = client.data.roleId === 1;
    if (!isAdmin && room.userId !== client.data.userId) {
      client.emit('error', { message: 'Access denied' });
      return;
    }
    try {
      const reactions = await this.chatService.react(
        message.id,
        client.data.userId,
        data.emoji ?? null,
      );
      this.server
        .to(`chat_room_${message.chatRoomId}`)
        .emit('messageReaction', {
          chatRoomId: message.chatRoomId,
          messageId: message.id,
          reactions,
        });
    } catch (err) {
      client.emit('error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      chatRoomId: number;
      message: string;
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
      /** Quote an earlier message of the same room (#073). */
      replyToId?: number;
    },
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

    // A quote must point at a message of this same room — otherwise a client
    // could pull a snippet of someone else's conversation into its own (#073).
    if (data.replyToId != null) {
      const quoted = await this.chatService.getMessageById(data.replyToId);
      if (!quoted || quoted.chatRoomId !== data.chatRoomId) {
        client.emit('error', {
          message: 'Replied message not found in this room',
        });
        return;
      }
    }

    const attachment = data.fileUrl
      ? {
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
        }
      : undefined;

    const message = await this.chatService.sendMessage(
      data.chatRoomId,
      client.data.userId,
      data.message,
      attachment,
      data.replyToId ?? null,
    );

    const roomName = `chat_room_${data.chatRoomId}`;
    this.server.to(roomName).emit('newMessage', message);

    // The customer is connected: the admin's message has reached them
    // (vande-1411 #035).
    if (isAdmin) void this.deliverIfCustomerOnline(data.chatRoomId, roomName);

    // Trigger 2: Send first-response message when user sends their first message
    if (!isAdmin) {
      void this.sendFirstResponseIfApplicable(
        data.chatRoomId,
        roomName,
        client.data.userId,
      );
    }
  }

  /**
   * Trigger Logic 2: Send automated first-response message after user's first message.
   * Checks if this is the first user message in the room (excluding bot messages).
   */
  private async sendFirstResponseIfApplicable(
    chatRoomId: number,
    roomName: string,
    userId: number,
  ): Promise<void> {
    try {
      // Get messages in the room — if only 1 user message exists, it's the first
      const messages = await this.chatService.getMessages(chatRoomId, 1, 10);
      const userMessages = messages.filter((m) => m.senderId === userId);

      // Only trigger if this is the very first user message
      if (userMessages.length !== 1) return;

      const firstResponseMsg =
        await this.chatAutomationsService.getFirstResponseMessage();
      if (!firstResponseMsg) return;

      const botMessage = await this.chatService.sendMessage(
        chatRoomId,
        null, // senderId=null represents the system/bot
        firstResponseMsg,
      );
      this.server.to(roomName).emit('newMessage', botMessage);
    } catch {
      // Silently ignore automation failures
    }
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

    // The customer saw the admin's messages: tell the CMS (vande-1411 #035).
    if (client.data.roleId !== 1) {
      this.server.to(`chat_room_${data.chatRoomId}`).emit('messagesStatus', {
        chatRoomId: data.chatRoomId,
        status: 'read',
      });
    }
  }

  /** Mark the admin's messages delivered and tell the CMS (vande-1411 #035). */
  private async markDeliveredAndTell(
    chatRoomId: number,
    roomName: string,
    customerId: number,
  ): Promise<void> {
    try {
      const changed = await this.chatService.markDelivered(
        chatRoomId,
        customerId,
      );
      if (changed > 0) {
        this.server
          .to(roomName)
          .emit('messagesStatus', { chatRoomId, status: 'delivered' });
      }
    } catch {
      // A status is a nicety; never fail a chat over it.
    }
  }

  /** An admin's message reaches a customer whose page is open now. */
  private async deliverIfCustomerOnline(
    chatRoomId: number,
    roomName: string,
  ): Promise<void> {
    try {
      const sockets = await this.server.in(roomName).fetchSockets();
      const customer = sockets.find(
        (s) => (s.data as { roleId?: number }).roleId !== 1,
      );
      const customerId = (customer?.data as { userId?: number } | undefined)
        ?.userId;
      if (customerId) {
        await this.markDeliveredAndTell(chatRoomId, roomName, customerId);
      }
    } catch {
      // Same: a status never fails a chat.
    }
  }

  @SubscribeMessage('subscribeAllRooms')
  async handleSubscribeAllRooms(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const isAdmin = client.data.roleId === 1;
    if (!isAdmin) {
      client.emit('error', { message: 'Admin only' });
      return;
    }

    const rooms = await this.chatService.getAllRooms();
    for (const room of rooms) {
      const roomName = `chat_room_${room.id}`;
      await client.join(roomName);
    }
    client.emit('subscribedAllRooms', { count: rooms.length });
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
