import { ValidationPipe } from '@nestjs/common';
import validationOptions from '../utils/validation-options';
import { normalizeAnnouncementEmails } from './announcement-window';
import { CreateCustomerAnnouncementDto } from './customer-announcement.dto';
import { CustomerAnnouncementsService } from './customer-announcements.service';

/**
 * vande #087: besides a customer group, an announcement can go to addresses
 * the admin types in — pasted with commas or entered one by one.
 */
const base = {
  subject: 'Ưu đãi riêng cho bạn',
  body: '<p>Chào bạn</p>',
  intervalSec: 5,
  period: 'all_time',
};

const validate = (body: object) =>
  new ValidationPipe(validationOptions).transform(body, {
    type: 'body',
    metatype: CreateCustomerAnnouncementDto,
  });

describe('Customer announcement to typed-in emails (vande #087)', () => {
  it('should keep each address once, trimmed and lower-cased', () => {
    expect(
      normalizeAnnouncementEmails([
        ' An@Example.com',
        'an@example.com',
        'binh@example.com ',
        '',
      ]),
    ).toEqual(['an@example.com', 'binh@example.com']);
  });

  it('should accept a list of addresses with audience "emails"', async () => {
    await expect(
      validate({ ...base, audience: 'emails', emails: ['an@example.com'] }),
    ).resolves.toMatchObject({ emails: ['an@example.com'] });
  });

  it('should refuse a malformed address or an empty list', async () => {
    await expect(
      validate({ ...base, audience: 'emails', emails: ['not-an-email'] }),
    ).rejects.toBeDefined();
    await expect(
      validate({ ...base, audience: 'emails', emails: [] }),
    ).rejects.toBeDefined();
  });

  it('should not ask for emails when a customer group is chosen', async () => {
    await expect(
      validate({ ...base, audience: 'purchased', period: 'last_30_days' }),
    ).resolves.toBeDefined();
  });

  it('should send to exactly the addresses typed in when its time comes', async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const manager = {
      query: jest.fn((sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes('FOR UPDATE SKIP LOCKED')) {
          return Promise.resolve([
            {
              id: 9,
              audience: 'emails',
              period: 'all_time',
              emails: ['an@example.com', 'binh@example.com'],
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };
    const service = new CustomerAnnouncementsService(
      {
        transaction: (fn: (m: typeof manager) => Promise<void>) => fn(manager),
      } as never,
      {} as never,
    );

    await (service as unknown as { startDue: () => Promise<void> }).startDue();

    const insert = queries.find((q) =>
      q.sql.includes('INSERT INTO customer_announcement_recipient'),
    );
    expect(insert?.sql).toContain('unnest($2::text[])');
    expect(insert?.params).toEqual([9, ['an@example.com', 'binh@example.com']]);
  });
});
