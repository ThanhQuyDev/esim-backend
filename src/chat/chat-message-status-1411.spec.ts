import { ChatGateway } from './chat.gateway';

/**
 * vande-1411 #035 — "Đã gửi / Đã nhận / Đã xem" for the admin. The storefront
 * joins a customer's room on every page, chat open or not, so joining only
 * delivers; the customer's own markAsRead (chat window open) is what "seen" is.
 */
describe('Trạng thái tin nhắn trong CMS (vande-1411 #035)', () => {
  function setup(roomSockets: { roleId: number; userId: number }[] = []) {
    const emitted: { room: string; event: string; payload: unknown }[] = [];
    const chatService = {
      getOrCreateRoom: jest.fn().mockResolvedValue({ id: 5 }),
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markDelivered: jest.fn().mockResolvedValue(2),
      getMessages: jest.fn().mockResolvedValue([{ id: 1 }]),
    };
    const gateway = new ChatGateway(
      chatService as never,
      {} as never,
      {} as never,
      {
        getWelcomeMessage: jest.fn().mockResolvedValue(null),
      } as never,
    );
    gateway.server = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) =>
          emitted.push({ room, event, payload }),
      }),
      in: () => ({
        socketsJoin: jest.fn(),
        fetchSockets: jest
          .fn()
          .mockResolvedValue(roomSockets.map((data) => ({ data }))),
      }),
    } as never;
    const client = (roleId: number, userId: number) =>
      ({ data: { roleId, userId }, join: jest.fn(), emit: jest.fn() }) as never;
    return { gateway, chatService, emitted, client };
  }
  const flush = () => new Promise((r) => setImmediate(r));

  it('should mark the customer messages seen when an admin opens the room', async () => {
    const { gateway, chatService, client } = setup();
    await gateway.handleJoinRoom(client(1, 99), { userId: 7 });
    expect(chatService.markAsRead).toHaveBeenCalledWith(5, 99);
    expect(chatService.markDelivered).not.toHaveBeenCalled();
  });

  it('should only deliver when the customer joins, and tell the CMS', async () => {
    const { gateway, chatService, emitted, client } = setup();
    await gateway.handleJoinRoom(client(2, 7), {});
    await flush();
    expect(chatService.markAsRead).not.toHaveBeenCalled();
    expect(chatService.markDelivered).toHaveBeenCalledWith(5, 7);
    expect(emitted).toContainEqual({
      room: 'chat_room_5',
      event: 'messagesStatus',
      payload: { chatRoomId: 5, status: 'delivered' },
    });
  });

  it("should report 'read' when the customer opens the chat window", async () => {
    const { gateway, emitted, client } = setup();
    await gateway.handleMarkAsRead(client(2, 7), { chatRoomId: 5 });
    expect(emitted).toContainEqual({
      room: 'chat_room_5',
      event: 'messagesStatus',
      payload: { chatRoomId: 5, status: 'read' },
    });
  });

  it("should not report 'read' when it is the admin reading", async () => {
    const { gateway, emitted, client } = setup();
    await gateway.handleMarkAsRead(client(1, 99), { chatRoomId: 5 });
    expect(emitted.filter((e) => e.event === 'messagesStatus')).toHaveLength(0);
  });
});
