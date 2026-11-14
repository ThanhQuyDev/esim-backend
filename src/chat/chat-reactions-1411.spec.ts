import { ChatService } from './chat.service';

/** vande-1411 #037 — one reaction per person; the same again takes it back. */
describe('Thả cảm xúc tin nhắn (vande-1411 #037)', () => {
  function service(reactions: Record<string, string> | null) {
    const stored: unknown[] = [];
    const repo = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 3, chatRoomId: 5, reactions }),
      setReactions: jest.fn((_id: number, r: unknown) => {
        stored.push(r);
        return Promise.resolve();
      }),
    };
    const s = Object.create(ChatService.prototype) as ChatService;
    Object.assign(s as unknown as Record<string, unknown>, {
      chatMessageRepository: repo,
    });
    return { s, stored };
  }

  it('should add a reaction, replace it, and take it back', async () => {
    let { s } = service(null);
    expect(await s.react(3, 7, '❤️')).toEqual({ '7': '❤️' });
    ({ s } = service({ '7': '❤️', '1': '👍' }));
    expect(await s.react(3, 7, '😂')).toEqual({ '7': '😂', '1': '👍' });
    ({ s } = service({ '7': '😂' }));
    expect(await s.react(3, 7, '😂')).toBeNull();
  });

  it('should refuse a reaction not on the list', async () => {
    const { s, stored } = service(null);
    await expect(s.react(3, 7, '💩')).rejects.toThrow();
    expect(stored).toHaveLength(0);
  });
});
