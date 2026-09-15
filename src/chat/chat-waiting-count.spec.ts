import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ADMINS_CHANNEL, ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatAutomationsService } from '../chat-automations/chat-automations.service';
import { AllConfigType } from '../config/config.type';

/**
 * The "customers waiting" badge on the CMS chat menu (#032).
 *
 * Two server-side faults kept it wrong or silent: the unread count included the
 * admin's own unread replies, and a customer who opened a chat after the admin
 * had subscribed was never delivered to that admin at all.
 */

describe('Chat waiting count', () => {
  it('should count only what the customer wrote, not the admin replies they have not read', async () => {
    const countUnreadFrom = jest.fn().mockResolvedValue(2);
    const countUnread = jest.fn().mockResolvedValue(5);
    const service = new ChatService(
      {
        findAllWithLastMessage: jest
          .fn()
          .mockResolvedValue([{ id: 4, userId: 6 }]),
      } as never,
      {
        findLastByRoomId: jest.fn().mockResolvedValue(null),
        countUnreadFrom,
        countUnread,
      } as never,
    );

    const [room] = await service.getAllRooms();

    expect(countUnreadFrom).toHaveBeenCalledWith(4, 6);
    expect(countUnread).not.toHaveBeenCalled();
    expect(room.unreadCount).toBe(2);
  });
});

describe('Chat gateway — new conversations reach admins', () => {
  function setup(roleId: number) {
    const socketsJoin = jest.fn();
    const emit = jest.fn();
    const gateway = new ChatGateway(
      {
        getOrCreateRoom: jest.fn().mockResolvedValue({ id: 9, userId: 77 }),
        markAsRead: jest.fn().mockResolvedValue(undefined),
        getMessages: jest.fn().mockResolvedValue([{ id: 1 }]),
      } as unknown as ChatService,
      {
        verify: jest.fn().mockReturnValue({
          id: roleId === 1 ? 1 : 77,
          role: { id: roleId },
          sessionId: 3,
        }),
      } as unknown as JwtService,
      {
        getOrThrow: jest.fn().mockReturnValue('secret'),
      } as unknown as ConfigService<AllConfigType>,
      {
        getWelcomeMessage: jest.fn().mockResolvedValue(null),
      } as unknown as ChatAutomationsService,
    );
    gateway.server = {
      in: jest.fn().mockReturnValue({ socketsJoin }),
      to: jest.fn().mockReturnValue({ emit }),
    } as never;

    const client = {
      handshake: { auth: { token: 'jwt' } },
      data: {} as Record<string, unknown>,
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    return { gateway, client, socketsJoin, emit };
  }

  it('should put an admin socket in the admins channel on connect', () => {
    const { gateway, client } = setup(1);

    gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith(ADMINS_CHANNEL);
  });

  it('should not put a customer socket in the admins channel', () => {
    const { gateway, client } = setup(2);

    gateway.handleConnection(client as never);

    expect(client.join).not.toHaveBeenCalledWith(ADMINS_CHANNEL);
  });

  it('should subscribe every admin to a room a customer opens and announce it', async () => {
    const { gateway, client, socketsJoin, emit } = setup(2);
    gateway.handleConnection(client as never);

    await gateway.handleJoinRoom(client as never, {});

    expect(gateway.server.in).toHaveBeenCalledWith(ADMINS_CHANNEL);
    expect(socketsJoin).toHaveBeenCalledWith('chat_room_9');
    expect(gateway.server.to).toHaveBeenCalledWith(ADMINS_CHANNEL);
    expect(emit).toHaveBeenCalledWith('roomsChanged');
  });

  it('should not re-announce rooms when an admin opens a conversation', async () => {
    const { gateway, client, socketsJoin } = setup(1);
    gateway.handleConnection(client as never);

    await gateway.handleJoinRoom(client as never, { userId: 77 });

    expect(socketsJoin).not.toHaveBeenCalled();
  });
});
