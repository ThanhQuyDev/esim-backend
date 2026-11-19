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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { ChatService } from './chat.service';
import { ChatAutomationsService } from '../chat-automations/chat-automations.service';
import { corsOrigin } from '../utils/cors-origins';
import { randomUUID } from 'crypto';
import { clientIp } from '../tickets/ticket-spam-guard';
import { ChatRoom } from './domain/chat-room';
import {
  GUEST_SENDER_ID,
  GUEST_TOKEN_TTL,
  guestLimits,
  guestMessageProblem,
  guestSecret,
} from './chat-guest';

/**
 * Every connected admin socket (#032). A customer who opens a conversation after
 * an admin subscribed to all rooms was never heard by that admin — no badge, no
 * notification — until the chat page was reloaded.
 */
export const ADMINS_CHANNEL = 'admins';

interface AuthenticatedSocket extends Socket {
  data: {
    /** GUEST_SENDER_ID for a visitor without an account (vande-2011 #023). */
    userId: number;
    roleId: number;
    sessionId: number;
    /** A visitor's key; their conversation is the room holding it (#023). */
    guestKey?: string;
    /** A visitor's freshly signed key, handed over in "joinedRoom". */
    newGuestToken?: string;
    /** The visitor's room, once joined: the only room they may use. */
    guestRoomId?: number;
    /** A signed-in customer's earlier visitor key, to adopt on join. */
    adoptGuestKey?: string;
    ip?: string;
  };
}

// Only esim sites may open the chat socket (security 15/11/2026; was '*').
@WebSocketGateway({ namespace: '/chat', cors: { origin: corsOrigin } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

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
      const guestToken = client.handshake.auth?.guest as string | undefined;
      client.data.ip = clientIp({
        headers: client.handshake.headers as Record<string, string>,
        socket: { remoteAddress: client.handshake.address },
      });

      if (token) {
        const payload = this.jwtService.verify(token as string, {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
        });

        client.data.userId = payload.id;
        client.data.roleId = payload.role?.id;
        client.data.sessionId = payload.sessionId;

        if (client.data.roleId === 1) {
          void client.join(ADMINS_CHANNEL);
        } else if (guestToken) {
          // Chatted as a visitor before signing in: that conversation
          // becomes this account's when it joins (vande-2011 #023).
          client.data.adoptGuestKey = this.guestKeyOf(guestToken) ?? undefined;
        }
        return;
      }

      // No account: a visitor (vande-2011 #023).
      const key = guestToken ? this.guestKeyOf(guestToken) : null;
      if (key) {
        client.data.guestKey = key;
      } else if (client.handshake.auth?.asGuest === true) {
        if (!guestLimits.mintPerIp.hit(client.data.ip).ok) {
          client.emit('error', { message: 'Too many new chats, try later' });
          client.disconnect();
          return;
        }
        client.data.guestKey = randomUUID();
        client.data.newGuestToken = this.jwtService.sign(
          { chatGuest: client.data.guestKey },
          { secret: this.guestSecret(), expiresIn: GUEST_TOKEN_TTL },
        );
      } else {
        client.disconnect();
        return;
      }
      client.data.userId = GUEST_SENDER_ID;
      client.data.roleId = 0;
    } catch {
      client.disconnect();
    }
  }

  private guestSecret(): string {
    return guestSecret(
      this.configService.getOrThrow('auth.secret', { infer: true }),
    );
  }

  /** The key in a visitor token, or null when it is not a valid one. */
  private guestKeyOf(token: string): string | null {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.guestSecret(),
      });
      return typeof payload?.chatGuest === 'string' ? payload.chatGuest : null;
    } catch {
      return null;
    }
  }

  /**
   * May this client use the room? An admin any room, a customer their own,
   * a visitor only the room of the key they hold — never by the visitors'
   * shared stand-in id (vande-2011 #023).
   */
  private ownsRoom(client: AuthenticatedSocket, room: ChatRoom): boolean {
    if (client.data.roleId === 1) return true;
    if (client.data.guestKey) {
      return room.isGuest === true && client.data.guestRoomId === room.id;
    }
    return (
      client.data.userId > 0 &&
      room.isGuest !== true &&
      room.userId === client.data.userId
    );
  }

  handleDisconnect() {}

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId?: number; roomId?: number; create?: boolean },
  ) {
    const isAdmin = client.data.roleId === 1;
    let room: ChatRoom | null;

    if (client.data.guestKey) {
      // A visitor: their own conversation, made only when they open the chat
      // (not on every page they visit) and within the per-IP limit (#023).
      room = await this.chatService.findGuestRoom(client.data.guestKey);
      if (!room && data?.create) {
        if (!guestLimits.roomsPerIp.hit(client.data.ip ?? 'unknown').ok) {
          client.emit('error', {
            message:
              'Bạn đã mở quá nhiều cuộc trò chuyện, vui lòng thử lại sau.',
          });
          return;
        }
        room = await this.chatService.createGuestRoom(
          client.data.guestKey,
          client.data.ip ?? 'unknown',
        );
      }
      if (!room) {
        client.emit('joinedRoom', {
          roomId: null,
          userId: GUEST_SENDER_ID,
          guestToken: client.data.newGuestToken,
        });
        return;
      }
      client.data.guestRoomId = room.id;
    } else if (isAdmin && data?.roomId) {
      // A visitor's conversation has no user to find it by (#023).
      room = await this.chatService.getRoomById(Number(data.roomId));
      if (!room) {
        client.emit('error', { message: 'Room not found' });
        return;
      }
    } else {
      if (client.data.adoptGuestKey) {
        const key = client.data.adoptGuestKey;
        client.data.adoptGuestKey = undefined;
        try {
          await this.chatService.adoptGuestRoom(key, client.data.userId);
          client.emit('guestAdopted');
        } catch (err) {
          // The visitor's conversation stays where it was.
          this.logger.warn(
            `Could not move a visitor chat to user ${client.data.userId}: ${(err as Error).message}`,
          );
        }
      }
      const targetUserId =
        isAdmin && data?.userId ? Number(data.userId) : client.data.userId;
      if (!(targetUserId > 0)) {
        client.emit('error', { message: 'Room not found' });
        return;
      }
      room = await this.chatService.getOrCreateRoom(targetUserId);
    }

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

    client.emit('joinedRoom', {
      roomId: room.id,
      userId: room.userId,
      guestToken: client.data.newGuestToken,
    });
    client.data.newGuestToken = undefined;

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
    if (!this.ownsRoom(client, room)) {
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
    if (!this.ownsRoom(client, room)) {
      client.emit('error', { message: 'Access denied' });
      return;
    }

    // A visitor: text only, no links or HTML, and a few messages a minute
    // (vande-2011 #023). Files need an account, so no new upload path.
    if (client.data.guestKey) {
      if (data.fileUrl) {
        client.emit('error', { message: 'Vui lòng đăng nhập để gửi tệp.' });
        return;
      }
      const problem = guestMessageProblem(String(data.message));
      if (problem) {
        client.emit('error', { message: problem });
        return;
      }
      const ip = client.data.ip ?? 'unknown';
      if (
        !guestLimits.messagesPerGuestMinute.hit(client.data.guestKey).ok ||
        !guestLimits.messagesPerGuestHour.hit(client.data.guestKey).ok ||
        !guestLimits.messagesPerIpMinute.hit(ip).ok
      ) {
        client.emit('error', {
          message: 'Bạn gửi tin nhắn quá nhanh, vui lòng đợi một chút.',
        });
        return;
      }
      data.message = String(data.message).trim();
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

    if (!this.ownsRoom(client, room)) {
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
    // Only someone in the conversation marks it read (vande-2011 #023).
    const room = await this.chatService.getRoomById(data.chatRoomId);
    if (!room || !this.ownsRoom(client, room)) return;

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
