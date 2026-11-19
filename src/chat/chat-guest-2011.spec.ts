import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { GUEST_SENDER_ID, guestMessageProblem } from './chat-guest';

/**
 * vande-2011 #023 — chat without an account. Anyone may now open the socket,
 * so what a visitor can reach and send is pinned down here.
 */
describe('Chat không cần đăng nhập (vande-2011 #023)', () => {
  const SECRET = 'test-secret';
  const jwt = new JwtService();
  const config = { getOrThrow: () => SECRET };

  function setup(rooms: Record<number, object> = {}) {
    const chatService = {
      getRoomById: jest.fn((id: number) => Promise.resolve(rooms[id] ?? null)),
      findGuestRoom: jest.fn().mockResolvedValue(null),
      createGuestRoom: jest
        .fn()
        .mockResolvedValue({ id: 40, userId: GUEST_SENDER_ID, isGuest: true }),
      adoptGuestRoom: jest.fn().mockResolvedValue(9),
      getOrCreateRoom: jest.fn().mockResolvedValue({ id: 9, userId: 7 }),
      getMessages: jest.fn().mockResolvedValue([{ id: 1 }]),
      getMessageById: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue({ id: 2 }),
      markAsRead: jest.fn(),
      markDelivered: jest.fn().mockResolvedValue(0),
    };
    const gateway = new ChatGateway(
      chatService as never,
      jwt,
      config as never,
      {
        getWelcomeMessage: jest.fn().mockResolvedValue(null),
        getFirstResponseMessage: jest.fn().mockResolvedValue(null),
      } as never,
    );
    gateway.server = {
      to: () => ({ emit: jest.fn() }),
      in: () => ({
        socketsJoin: jest.fn(),
        fetchSockets: jest.fn().mockResolvedValue([]),
      }),
    } as never;
    return { gateway, chatService };
  }

  function socket(auth: Record<string, unknown>, ip = '203.0.113.9') {
    return {
      handshake: {
        auth,
        query: {},
        headers: { 'x-real-ip': ip },
        address: '127.0.0.1',
      },
      data: {} as Record<string, unknown>,
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn(),
    };
  }

  it('should refuse a socket with neither a login nor a visitor request', () => {
    const { gateway } = setup();
    const s = socket({});
    gateway.handleConnection(s as never);
    expect(s.disconnect).toHaveBeenCalled();
  });

  it('should give a new visitor a key signed with its own secret', async () => {
    const { gateway } = setup();
    const s = socket({ asGuest: true });
    gateway.handleConnection(s as never);
    expect(s.disconnect).not.toHaveBeenCalled();
    expect(s.data.userId).toBe(GUEST_SENDER_ID);
    await gateway.handleJoinRoom(s as never, { create: true });
    const joined = s.emit.mock.calls.find((c) => c[0] === 'joinedRoom')?.[1];
    expect(joined.roomId).toBe(40);
    // Not a login token: the login secret does not verify it.
    expect(() => jwt.verify(joined.guestToken, { secret: SECRET })).toThrow();
    // And a login token is not a visitor token.
    const login = jwt.sign({ id: 7, role: { id: 2 } }, { secret: SECRET });
    const t = socket({ guest: login });
    gateway.handleConnection(t as never);
    expect(t.disconnect).toHaveBeenCalled();
  });

  it("should keep a visitor out of another visitor's and a customer's room", async () => {
    const { gateway, chatService } = setup({
      41: { id: 41, userId: GUEST_SENDER_ID, isGuest: true },
      9: { id: 9, userId: 7, isGuest: false },
    });
    chatService.findGuestRoom.mockResolvedValue({
      id: 40,
      userId: GUEST_SENDER_ID,
      isGuest: true,
    });
    const s = socket({ asGuest: true });
    gateway.handleConnection(s as never);
    await gateway.handleJoinRoom(s as never, {});
    for (const chatRoomId of [41, 9]) {
      s.emit.mockClear();
      await gateway.handleGetMessages(s as never, { chatRoomId });
      await gateway.handleSendMessage(s as never, {
        chatRoomId,
        message: 'hi',
      });
      expect(s.emit.mock.calls.map((c) => c[1]?.message)).toEqual([
        'Access denied',
        'Access denied',
      ]);
    }
    expect(chatService.sendMessage).not.toHaveBeenCalled();
  });

  it("should keep a customer out of a visitor's room", async () => {
    const { gateway } = setup({
      40: { id: 40, userId: GUEST_SENDER_ID, isGuest: true },
    });
    const s = { data: { userId: 7, roleId: 2 }, emit: jest.fn() };
    await gateway.handleGetMessages(s as never, { chatRoomId: 40 });
    expect(s.emit).toHaveBeenCalledWith('error', { message: 'Access denied' });
  });

  it('should refuse files, links and HTML from a visitor, and slow down a flood', async () => {
    const room = { id: 40, userId: GUEST_SENDER_ID, isGuest: true };
    const { gateway, chatService } = setup({ 40: room });
    chatService.findGuestRoom.mockResolvedValue(room);
    const s = socket({ asGuest: true }, '198.51.100.4');
    gateway.handleConnection(s as never);
    await gateway.handleJoinRoom(s as never, {});
    await gateway.handleSendMessage(s as never, {
      chatRoomId: 40,
      message: 'x',
      fileUrl: 'https://res.cloudinary.com/a.png',
    });
    await gateway.handleSendMessage(s as never, {
      chatRoomId: 40,
      message: 'xem www.spam.example',
    });
    expect(chatService.sendMessage).not.toHaveBeenCalled();
    for (let i = 0; i < 10; i++) {
      await gateway.handleSendMessage(s as never, {
        chatRoomId: 40,
        message: `Câu hỏi ${i}`,
      });
    }
    expect(chatService.sendMessage).toHaveBeenCalledTimes(8);
    expect(chatService.sendMessage).toHaveBeenCalledWith(
      40,
      GUEST_SENDER_ID,
      'Câu hỏi 0',
      undefined,
      null,
    );
  });

  it('should move the visitor chat to the account when they sign in', async () => {
    const { gateway, chatService } = setup();
    const guestToken = jwt.sign(
      { chatGuest: 'k-1' },
      { secret: `${SECRET}:chat-guest` },
    );
    const login = jwt.sign({ id: 7, role: { id: 2 } }, { secret: SECRET });
    const s = socket({ token: login, guest: guestToken });
    gateway.handleConnection(s as never);
    await gateway.handleJoinRoom(s as never, {});
    expect(chatService.adoptGuestRoom).toHaveBeenCalledWith('k-1', 7);
    expect(chatService.getOrCreateRoom).toHaveBeenCalledWith(7);
    expect(s.emit).toHaveBeenCalledWith('guestAdopted');
  });

  it('should tell links and HTML from an email address', () => {
    expect(guestMessageProblem('Email em: an.nguyen@gmail.com')).toBeNull();
    expect(guestMessageProblem('Gói Nhật 5 ngày giá bao nhiêu?')).toBeNull();
    expect(guestMessageProblem('vào https://x.y')).not.toBeNull();
    expect(guestMessageProblem('casino88.bet khuyến mãi')).not.toBeNull();
    expect(guestMessageProblem('<script>alert(1)</script>')).not.toBeNull();
    expect(guestMessageProblem('a'.repeat(1001))).not.toBeNull();
    expect(guestMessageProblem('   ')).not.toBeNull();
  });
});
