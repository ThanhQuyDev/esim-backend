import { TicketsService, safeAttachmentUrls } from './tickets.service';
import {
  fetchEmailAttachments,
  attachmentFileName,
} from '../mail/mail.service';

/**
 * vande-1411 #034 — an admin's reply can carry files: they show in the thread
 * and go with the email to the customer or partner.
 */
describe('Admin trả lời ticket kèm tệp (vande-1411 #034)', () => {
  const PNG = 'https://res.cloudinary.com/demo/image/upload/v1/huong-dan.png';

  it('should keep https uploads only, never a local path', () => {
    expect(
      safeAttachmentUrls([
        PNG,
        '/etc/passwd',
        'file:///c:/x',
        'data:text/plain,hi',
        42,
      ]),
    ).toEqual([PNG]);
    expect(safeAttachmentUrls(undefined)).toEqual([]);
    expect(safeAttachmentUrls(Array(12).fill(PNG))).toHaveLength(10);
  });

  it('should name a file after its address', () => {
    expect(attachmentFileName(PNG, 0)).toBe('huong-dan.png');
    expect(attachmentFileName('not a url', 1)).toBe('tep-dinh-kem-2');
  });

  it('should fetch only our upload host, and skip one that fails', async () => {
    const fetchImpl = jest.fn((url: string) =>
      Promise.resolve(
        url.includes('loi')
          ? ({ ok: false } as Response)
          : ({
              ok: true,
              headers: new Headers({ 'content-type': 'image/png' }),
              arrayBuffer: () =>
                Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
            } as unknown as Response),
      ),
    );
    const files = await fetchEmailAttachments(
      [
        PNG,
        'https://evil.example.com/x.png',
        'https://res.cloudinary.com/demo/loi.png',
      ],
      fetchImpl as never,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2); // never the foreign host
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      filename: 'huong-dan.png',
      contentType: 'image/png',
    });
  });

  function makeService() {
    const ticket = {
      id: 9,
      ticketNumber: 'HT-000009',
      customerEmail: 'doitac@congty.vn',
      subject: 'Lỗi',
      status: 'in_progress',
      fromPartner: true,
    };
    const saved: Record<string, unknown>[] = [];
    const repository = {
      findById: jest.fn().mockResolvedValue(ticket),
      update: jest.fn().mockResolvedValue(ticket),
    };
    const messages = {
      create: (row: unknown) => row,
      save: jest.fn((row: Record<string, unknown>) => {
        saved.push(row);
        return Promise.resolve({ id: 1, ...row });
      }),
    };
    const mailService = {
      sendTicketReply: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TicketsService(
      repository as never,
      messages as never,
      mailService as never,
    );
    (service as unknown as Record<string, unknown>).logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return { service, saved, mailService };
  }

  it("should put an admin's files in the thread and in the email", async () => {
    const { service, saved, mailService } = makeService();
    await service.addMessage(
      9,
      { isAdmin: true, name: 'Hỗ trợ' },
      {
        body: 'Anh xem hướng dẫn kèm theo.',
        attachments: [PNG, '/etc/passwd'],
      },
    );
    expect(saved[0].attachments).toEqual([PNG]);
    expect(mailService.sendTicketReply).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'doitac@congty.vn',
        attachments: [PNG],
        isPartner: true,
      }),
    );
  });

  it('should send a reply that is only a file', async () => {
    const { service, saved } = makeService();
    await service.addMessage(
      9,
      { isAdmin: true },
      { body: '  ', attachments: [PNG] },
    );
    expect(saved[0]).toMatchObject({
      body: '(Gửi kèm tệp đính kèm)',
      attachments: [PNG],
    });
  });
});
