import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { sanitizeNotificationHtml } from '../partners/notification-html';
import { RoleEnum } from '../roles/roles.enum';
import {
  announcementWindow,
  type AnnouncementAudience,
  type AnnouncementPeriod,
} from './announcement-window';
import { CreateCustomerAnnouncementDto } from './customer-announcement.dto';

/** Orders that went through — refunded ones were bought all the same. */
export const PURCHASED_ORDER_STATUSES = ['paid', 'completed', 'refunded'];
export const FAILED_ORDER_STATUS = 'failed';

/** How often a failed email is retried before it is given up. */
const MAX_ATTEMPTS = 3;

export type CustomerAnnouncementRow = {
  id: number;
  subject: string;
  body: string;
  audience: AnnouncementAudience;
  period: AnnouncementPeriod;
  intervalSec: number;
  scheduledAt: Date;
  status: 'scheduled' | 'sending' | 'sent' | 'cancelled';
  recipientCount: number | null;
  sentCount: number;
  failedCount: number;
  createdByName: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

/**
 * The customers an announcement goes to (vande #072), as SQL over `user`:
 * storefront customers — a "Người dùng" by main role or one ticked on top
 * (#071) — still active, with an email. `$1`/`$2` are the window, as
 * timestamptz or null.
 */
export function audienceSql(audience: AnnouncementAudience): string {
  const purchased = `o.status IN (${PURCHASED_ORDER_STATUSES.map((s) => `'${s}'`).join(', ')})`;
  const failed = `o.status = '${FAILED_ORDER_STATUS}'`;
  const inWindow = (column: string) =>
    `($1::timestamptz IS NULL OR ${column} >= ($1::timestamptz AT TIME ZONE 'UTC'))
     AND ($2::timestamptz IS NULL OR ${column} < ($2::timestamptz AT TIME ZONE 'UTC'))`;
  const order = (where: string, window = false) =>
    `EXISTS (SELECT 1 FROM "order" o WHERE o."userId" = u.id AND ${where}${
      window ? ` AND ${inWindow('o."createdAt"')}` : ''
    })`;

  const who =
    audience === 'new'
      ? `NOT ${order(`(${purchased} OR ${failed})`)} AND ${inWindow('u."createdAt"')}`
      : audience === 'purchased'
        ? order(purchased, true)
        : `${order(failed, true)} AND NOT ${order(purchased)}`;

  return `SELECT u.id AS "userId", lower(u.email) AS email,
                 NULLIF(trim(concat_ws(' ', u."firstName", u."lastName")), '') AS name
            FROM "user" u
           WHERE u."deletedAt" IS NULL
             AND u.email IS NOT NULL AND u.email <> ''
             AND (u."statusId" IS NULL OR u."statusId" = 1)
             AND (u."roleId" = ${RoleEnum.user} OR ${RoleEnum.user} = ANY(u."extraRoleIds"))
             AND ${who}`;
}

/**
 * Announcements to storefront customers by email (vande #072): composed in
 * the CMS, sent now or at a set time, one email at a time with the interval
 * the admin chose between them, from service@esim.com.vn.
 */
@Injectable()
export class CustomerAnnouncementsService {
  private readonly logger = new Logger(CustomerAnnouncementsService.name);
  private ticking = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  private windowParams(period: AnnouncementPeriod, now = new Date()) {
    const { from, to } = announcementWindow(period, now);
    return [from?.toISOString() ?? null, to?.toISOString() ?? null];
  }

  /** "Dự kiến N khách hàng nhận" for the group and window chosen. */
  async countAudience(
    audience: AnnouncementAudience,
    period: AnnouncementPeriod,
  ): Promise<{ recipients: number }> {
    const [row] = (await this.dataSource.query(
      `SELECT COUNT(DISTINCT email)::int AS n FROM (${audienceSql(audience)}) a`,
      this.windowParams(period),
    )) as { n: number }[];
    return { recipients: row?.n ?? 0 };
  }

  /** The email as it will arrive, for the CMS preview. */
  async preview(subject: string, body: string): Promise<{ html: string }> {
    const rendered = await this.mailService.renderCustomerAnnouncement({
      subject: subject || '(Chưa có tiêu đề)',
      body: sanitizeNotificationHtml(body),
      customerName: 'Nguyễn Văn A',
    });
    return {
      html:
        rendered?.html ??
        '<p style="font-family:sans-serif">Chưa có mẫu email "customer_announcement".</p>',
    };
  }

  async list(limit = 100): Promise<CustomerAnnouncementRow[]> {
    const rows = (await this.dataSource.query(
      `SELECT a.*,
              (SELECT COUNT(*)::int FROM customer_announcement_recipient r
                WHERE r."announcementId" = a.id AND r."sentAt" IS NOT NULL) AS "sentCount",
              (SELECT COUNT(*)::int FROM customer_announcement_recipient r
                WHERE r."announcementId" = a.id AND r."sentAt" IS NULL
                  AND r.attempts >= ${MAX_ATTEMPTS}) AS "failedCount"
         FROM customer_announcement a
        ORDER BY a."createdAt" DESC
        LIMIT $1`,
      [Math.min(Math.max(limit, 1), 500)],
    )) as CustomerAnnouncementRow[];
    return rows;
  }

  async create(
    dto: CreateCustomerAnnouncementDto,
    admin: { id: number; name?: string | null },
  ): Promise<CustomerAnnouncementRow> {
    const body = sanitizeNotificationHtml(dto.body);
    if (!body.replace(/<[^>]+>/g, '').trim()) {
      throw new BadRequestException('Vui lòng nhập nội dung thông báo.');
    }
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Thời gian đặt lịch phải ở tương lai.');
    }
    const [row] = (await this.dataSource.query(
      `INSERT INTO customer_announcement
              (subject, body, audience, period, "intervalSec", "scheduledAt",
               status, "createdByAdminId", "createdByName")
       VALUES ($1, $2, $3, $4, $5,
               COALESCE($6::timestamptz, now()),
               'scheduled', $7, $8)
       RETURNING *`,
      [
        dto.subject.trim(),
        body,
        dto.audience,
        dto.period,
        dto.intervalSec,
        scheduledAt?.toISOString() ?? null,
        admin.id,
        admin.name ?? null,
      ],
    )) as CustomerAnnouncementRow[];
    // Sent now: start straight away rather than at the next tick.
    if (!scheduledAt) void this.tick();
    return { ...row, sentCount: 0, failedCount: 0 };
  }

  /** "Hủy": nothing more is sent; emails already out stay out. */
  async cancel(id: number): Promise<CustomerAnnouncementRow> {
    const result = (await this.dataSource.query(
      `UPDATE customer_announcement
          SET status = 'cancelled', "finishedAt" = now()
        WHERE id = $1 AND status IN ('scheduled', 'sending')
        RETURNING *`,
      [id],
    )) as unknown[];
    // UPDATE … RETURNING comes back from the pg driver as [rows, affected].
    const rows = (
      Array.isArray(result[0]) ? result[0] : result
    ) as CustomerAnnouncementRow[];
    if (!rows.length) {
      const [exists] = await this.dataSource.query(
        `SELECT status FROM customer_announcement WHERE id = $1`,
        [id],
      );
      if (!exists) throw new NotFoundException('Không tìm thấy thông báo.');
      throw new BadRequestException(
        'Thông báo này đã gửi xong, không hủy được.',
      );
    }
    return rows[0];
  }

  /**
   * Start the announcements whose time has come — the customer list is read
   * at that moment — and send the next emails of those under way.
   */
  @Interval(2_000)
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.startDue();
      await this.sendDue();
      await this.finishDone();
    } catch (err) {
      this.logger.error(`Customer announcements: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  private async startDue(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [due] = (await manager.query(
        `SELECT id, audience, period FROM customer_announcement
          WHERE status = 'scheduled' AND "scheduledAt" <= now()
          ORDER BY "scheduledAt" LIMIT 1
          FOR UPDATE SKIP LOCKED`,
      )) as {
        id: number;
        audience: AnnouncementAudience;
        period: AnnouncementPeriod;
      }[];
      if (!due) return;
      const [from, to] = this.windowParams(due.period);
      await manager.query(
        `INSERT INTO customer_announcement_recipient
                ("announcementId", "userId", email, name)
         SELECT DISTINCT ON (a.email) $3::int, a."userId", a.email, a.name
           FROM (${audienceSql(due.audience)}) a
          ORDER BY a.email
         ON CONFLICT ("announcementId", email) DO NOTHING`,
        [from, to, due.id],
      );
      await manager.query(
        `UPDATE customer_announcement
            SET status = 'sending', "startedAt" = now(),
                "recipientCount" = (SELECT COUNT(*) FROM customer_announcement_recipient
                                     WHERE "announcementId" = $1)
          WHERE id = $1`,
        [due.id],
      );
    });
  }

  private async sendDue(): Promise<void> {
    // The next email of each announcement under way, once the one before it
    // went out at least its interval ago — a poll that fell behind must not
    // send a backlog in one burst. Leased for two minutes while it is sent.
    const claimed = (await this.dataSource.query(
      `UPDATE customer_announcement_recipient
          SET attempts = attempts + 1,
              "sendAt" = now() + interval '2 minutes'
        WHERE id IN (
                SELECT id FROM (
                  SELECT r.id, row_number() OVER (
                           PARTITION BY r."announcementId" ORDER BY r.id) AS n
                    FROM customer_announcement_recipient r
                    JOIN customer_announcement a ON a.id = r."announcementId"
                   WHERE a.status = 'sending'
                     AND r."sentAt" IS NULL AND r.attempts < ${MAX_ATTEMPTS}
                     AND r."sendAt" <= now()
                     AND NOT EXISTS (
                           SELECT 1 FROM customer_announcement_recipient p
                            WHERE p."announcementId" = r."announcementId"
                              AND p."sentAt" > now() - make_interval(secs => a."intervalSec"))
                ) due
                WHERE due.n = 1
                LIMIT 5)
          AND "sentAt" IS NULL AND "sendAt" <= now()
        RETURNING id, "announcementId", email, name`,
    )) as unknown[];
    const rows = (Array.isArray(claimed[0]) ? claimed[0] : claimed) as {
      id: number;
      announcementId: number;
      email: string;
      name: string | null;
    }[];

    for (const row of rows) {
      const [announcement] = (await this.dataSource.query(
        `SELECT subject, body, status FROM customer_announcement WHERE id = $1`,
        [row.announcementId],
      )) as { subject: string; body: string; status: string }[];
      if (announcement?.status !== 'sending') continue;
      try {
        await this.mailService.sendCustomerAnnouncement({
          to: row.email,
          subject: announcement.subject,
          body: announcement.body,
          customerName: row.name,
        });
        await this.dataSource.query(
          `UPDATE customer_announcement_recipient
              SET "sentAt" = now(), "lastError" = NULL WHERE id = $1`,
          [row.id],
        );
      } catch (err) {
        await this.dataSource.query(
          `UPDATE customer_announcement_recipient
              SET "lastError" = $2, "sendAt" = now() + interval '1 minute'
            WHERE id = $1`,
          [row.id, (err as Error).message.slice(0, 500)],
        );
        this.logger.error(
          `Announcement ${row.announcementId} to ${row.email} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  /** "Đã gửi" once nobody is left to send to (or to retry). */
  private async finishDone(): Promise<void> {
    await this.dataSource.query(
      `UPDATE customer_announcement a
          SET status = 'sent', "finishedAt" = now()
        WHERE a.status = 'sending'
          AND NOT EXISTS (SELECT 1 FROM customer_announcement_recipient r
                           WHERE r."announcementId" = a.id AND r."sentAt" IS NULL
                             AND r.attempts < ${MAX_ATTEMPTS})`,
    );
  }
}
