import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatAutomationsService } from '../chat-automations/chat-automations.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { ChatMessage } from './domain/chat-message';

/**
 * Replying to a specific message (#073).
 *
 * The rule that matters for security is the room check: a quote id is supplied
 * by the client, so without it any logged-in customer could pull a snippet of
 * someone else's conversation into their own room.
 */
describe('ChatGateway — reply to a specific message', () => {
  const ROOM_ID = 7;
  const OWNER_ID = 42;

  function buildMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      id: 100,
      chatRoomId: ROOM_ID,
      senderId: OWNER_ID,
      message: 'Bao giờ eSIM của tôi được kích hoạt?',
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as ChatMessage;
  }

  function setup(
    quoted: ChatMessage | null,
    { roleId = 1 }: { roleId?: number } = {},
  ) {
    const sendMessage = jest.fn().mockResolvedValue(buildMessage({ id: 200 }));
    const chatService = {
      getRoomById: jest
        .fn()
        .mockResolvedValue({ id: ROOM_ID, userId: OWNER_ID }),
      getMessageById: jest.fn().mockResolvedValue(quoted),
      getMessages: jest.fn().mockResolvedValue([buildMessage()]),
      sendMessage,
    } as unknown as ChatService;

    const gateway = new ChatGateway(
      chatService,
      {} as JwtService,
      {} as ConfigService<AllConfigType>,
      {
        getWelcomeMessage: jest.fn().mockResolvedValue(null),
        getFirstResponseMessage: jest.fn().mockResolvedValue(null),
      } as unknown as ChatAutomationsService,
    );

    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as never;

    const client = {
      data: { userId: roleId === 1 ? 1 : OWNER_ID, roleId, sessionId: 1 },
      emit: jest.fn(),
    } as never;

    return { gateway, chatService, client, sendMessage };
  }

  it('should pass the quoted id through when it belongs to the same room', async () => {
    const { gateway, client, sendMessage } = setup(buildMessage());

    await gateway.handleSendMessage(client, {
      chatRoomId: ROOM_ID,
      message: 'Trong vòng 5 phút bạn nhé.',
      replyToId: 100,
    });

    expect(sendMessage).toHaveBeenCalledWith(
      ROOM_ID,
      expect.any(Number),
      'Trong vòng 5 phút bạn nhé.',
      undefined,
      100,
    );
  });

  it('should refuse a quote that belongs to another room', async () => {
    const { gateway, client, sendMessage } = setup(
      buildMessage({ chatRoomId: 999 }),
    );

    await gateway.handleSendMessage(client, {
      chatRoomId: ROOM_ID,
      message: 'Trích tin của phòng khác',
      replyToId: 100,
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(
      (client as unknown as { emit: jest.Mock }).emit,
    ).toHaveBeenCalledWith('error', {
      message: 'Replied message not found in this room',
    });
  });

  it('should refuse a quote id that does not exist', async () => {
    const { gateway, client, sendMessage } = setup(null);

    await gateway.handleSendMessage(client, {
      chatRoomId: ROOM_ID,
      message: 'Trích tin đã bị xoá',
      replyToId: 12345,
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should send a plain message with no quote when replyToId is absent', async () => {
    const { gateway, chatService, client, sendMessage } = setup(buildMessage());

    await gateway.handleSendMessage(client, {
      chatRoomId: ROOM_ID,
      message: 'Xin chào',
    });

    expect(
      (chatService as unknown as { getMessageById: jest.Mock }).getMessageById,
    ).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      ROOM_ID,
      expect.any(Number),
      'Xin chào',
      undefined,
      null,
    );
  });
});
