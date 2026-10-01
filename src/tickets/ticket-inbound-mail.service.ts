import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { AllConfigType } from '../config/config.type';
import { TicketsService } from './tickets.service';

/**
 * Reads replies out of the support mailbox and files them onto their ticket
 * (#059).
 *
 * The chosen approach is IMAP polling of `support@esim.com.vn` rather than a mail
 * provider's inbound webhook: no MX change, no monthly cost, and the mailbox
 * already exists. The trade-off is that the quoted history has to be stripped
 * here instead of by a provider — {@link extractReplyText} does that.
 *
 * Entirely off unless `mail.inbound.host` is configured, so an environment that
 * has not been given the mailbox keeps working exactly as before.
 */
@Injectable()
export class TicketInboundMailService implements OnModuleDestroy {
  private readonly logger = new Logger(TicketInboundMailService.name);

  /**
   * Guards against a slow pass overlapping the next tick. One mailbox, one
   * reader — two connections racing would file the same reply twice.
   */
  private running = false;

  private destroyed = false;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly ticketsService: TicketsService,
  ) {}

  onModuleDestroy(): void {
    this.destroyed = true;
  }

  private get settings() {
    return this.configService.get('mail.inbound', { infer: true });
  }

  get enabled(): boolean {
    const inbound = this.settings;
    return !!inbound?.host && !!inbound?.user && !!inbound?.password;
  }

  /**
   * Every two minutes: fast enough that a customer's reply shows up while the
   * conversation is still live, slow enough to be a negligible load on the
   * mailbox. (`CronExpression` has no 2-minute constant.)
   */
  @Cron('*/2 * * * *')
  async pollInbox(): Promise<{ processed: number; skipped: number }> {
    if (!this.enabled || this.destroyed) return { processed: 0, skipped: 0 };
    if (this.running) {
      this.logger.warn(
        'Previous inbox poll still running — skipping this tick',
      );
      return { processed: 0, skipped: 0 };
    }

    this.running = true;
    const inbound = this.settings!;
    const client = new ImapFlow({
      host: inbound.host!,
      port: inbound.port,
      secure: inbound.secure,
      auth: { user: inbound.user!, pass: inbound.password! },
      // The library logs every IMAP command at info level otherwise.
      logger: false,
    });

    let processed = 0;
    let skipped = 0;

    try {
      await client.connect();
      const lock = await client.getMailboxLock(inbound.mailbox);

      try {
        // Unseen only: a message is marked read once it has been filed, which is
        // what stops it being processed twice across restarts.
        const unseen = await client.search({ seen: false });
        const uids = Array.isArray(unseen) ? unseen : [];

        for (const uid of uids) {
          if (this.destroyed) break;

          try {
            const message = await client.fetchOne(String(uid), {
              source: true,
            });
            if (!message || typeof message === 'boolean' || !message.source) {
              skipped += 1;
              continue;
            }

            const parsed = await simpleParser(message.source);
            const fromEmail = parsed.from?.value?.[0]?.address ?? null;

            const filedUnder = await this.ticketsService.ingestEmailReply({
              subject: parsed.subject ?? null,
              fromEmail,
              body: parsed.text ?? parsed.html?.toString() ?? null,
            });

            if (filedUnder) {
              // Marked read ONLY once it is safely on the ticket, so a crash
              // mid-pass leaves it to be retried rather than losing it.
              await client.messageFlagsAdd(String(uid), ['\\Seen'], {
                uid: true,
              });
              processed += 1;
            } else {
              // Left unread on purpose: an unmatched mail is something a human
              // should look at, not something to bury.
              skipped += 1;
            }
          } catch (err) {
            skipped += 1;
            this.logger.error(
              `Inbound mail uid ${uid} failed — ${(err as Error).message}`,
            );
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      // A mailbox outage must never take the API down with it.
      this.logger.error(
        `Could not poll the support mailbox — ${(err as Error).message}`,
      );
    } finally {
      try {
        await client.logout();
      } catch {
        // Already disconnected; nothing to do.
      }
      this.running = false;
    }

    if (processed > 0 || skipped > 0) {
      this.logger.log(
        `Support mailbox: ${processed} reply/replies filed, ${skipped} left for review`,
      );
    }

    return { processed, skipped };
  }
}
