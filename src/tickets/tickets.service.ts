import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketMessageEntity } from './infrastructure/persistence/relational/entities/ticket-message.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketRepository } from './infrastructure/persistence/ticket.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Ticket } from './domain/ticket';
import {
  SlidingWindowLimiter,
  TICKET_DUPLICATE_WINDOW_MS,
  TICKET_EMAIL_LIMIT,
  TICKET_EMAIL_WINDOW_MS,
  TICKET_IP_LIMIT,
  TICKET_IP_WINDOW_MS,
} from './ticket-spam-guard';
import { Cron, CronExpression } from '@nestjs/schedule';
import { parseTicketNumber, ticketNumberFor } from './ticket-number';
import { extractReplyText } from './email-reply-text';
import { TicketStatus, TICKET_AUTO_CLOSE_HOURS } from './ticket-status';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  private readonly ipLimiter = new SlidingWindowLimiter(
    TICKET_IP_LIMIT,
    TICKET_IP_WINDOW_MS,
  );

  constructor(
    private readonly ticketRepository: TicketRepository,
    @InjectRepository(TicketMessageEntity)
    private readonly messageRepository: Repository<TicketMessageEntity>,
    private readonly mailService: MailService,
  ) {}

  /**
   * The conversation on one ticket (#032).
   *
   * Only the person who opened it and staff may read it: a ticket carries
   * order numbers, ICCIDs and whatever the customer pasted in.
   */
  async listMessages(
    ticketId: number,
    requester: { email?: string | null; isAdmin: boolean },
  ): Promise<TicketMessageEntity[]> {
    await this.assertCanSeeTicket(ticketId, requester);

    return this.messageRepository.find({
      where: { ticketId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Add a reply to a ticket, from either side of it (#032). */
  async addMessage(
    ticketId: number,
    requester: {
      email?: string | null;
      isAdmin: boolean;
      name?: string | null;
    },
    input: { body: string; attachments?: string[] },
  ): Promise<TicketMessageEntity> {
    await this.assertCanSeeTicket(ticketId, requester);

    const body = input.body?.trim();
    if (!body) {
      throw new BadRequestException('Nội dung phản hồi không được để trống.');
    }

    const message = await this.messageRepository.save(
      this.messageRepository.create({
        ticketId,
        authorRole: requester.isAdmin ? 'admin' : 'customer',
        authorName: requester.name ?? null,
        body,
        attachments: input.attachments?.length ? input.attachments : null,
      }),
    );

    // A reply from support reopens a ticket that was closed prematurely, and a
    // reply from the customer means it is not resolved after all.
    const ticket = await this.ticketRepository.findById(ticketId);
    if (ticket && ticket.status === 'closed') {
      await this.ticketRepository.update(ticketId, { status: 'open' } as never);
    }

    // An admin's reply is emailed to the customer, so support no longer has to
    // leave the CMS and compose it by hand (#059). A customer's own reply is not
    // emailed back to them.
    if (requester.isAdmin && ticket?.customerEmail) {
      const ticketNumber =
        ticket.ticketNumber ?? ticketNumberFor(Number(ticket.id));
      try {
        await this.mailService.sendTicketReply({
          to: ticket.customerEmail,
          ticketNumber,
          ticketSubject: ticket.subject,
          replyBody: body,
        });
      } catch (err) {
        // The message is already saved and visible in the CMS; losing the email
        // must not lose the reply.
        this.logger.error(
          `Ticket ${ticketNumber}: reply email failed — ${(err as Error).message}`,
        );
      }
    }

    return message;
  }

  /**
   * Record a reply that arrived by email as a message on its ticket (#059).
   *
   * Called by the IMAP poller, not by a request, so it takes the sender's address
   * as the identity rather than an authenticated user. Two guards matter:
   *
   * - the ticket is found by the `HT-000123` in the subject, and a mail with no
   *   recognisable number is skipped rather than guessed at
   * - the sender must be the ticket's own customer, or anyone who learns a ticket
   *   number could post into a stranger's thread
   *
   * Returns the ticket number it was filed under, or null when it was skipped —
   * the poller logs that, and leaves the mail unread for a human to look at.
   */
  async ingestEmailReply(input: {
    subject?: string | null;
    fromEmail?: string | null;
    body?: string | null;
  }): Promise<string | null> {
    const ticketNumber = parseTicketNumber(input.subject);
    if (!ticketNumber) return null;

    const ticket = await this.ticketRepository.findByTicketNumber(ticketNumber);
    if (!ticket) {
      this.logger.warn(
        `Inbound mail quotes ${ticketNumber}, which does not exist — skipped`,
      );
      return null;
    }

    const from = input.fromEmail?.trim().toLowerCase();
    if (!from || ticket.customerEmail?.trim().toLowerCase() !== from) {
      this.logger.warn(
        `Inbound mail for ${ticketNumber} came from ${from ?? 'nobody'}, not the ticket's customer — skipped`,
      );
      return null;
    }

    const body = extractReplyText(input.body);
    if (!body) {
      this.logger.warn(
        `Inbound mail for ${ticketNumber} had no text — skipped`,
      );
      return null;
    }

    await this.addMessage(
      Number(ticket.id),
      { email: ticket.customerEmail, isAdmin: false, name: null },
      { body },
    );

    this.logger.log(`Inbound reply filed under ${ticketNumber}`);
    return ticketNumber;
  }

  private async assertCanSeeTicket(
    ticketId: number,
    requester: { email?: string | null; isAdmin: boolean },
  ): Promise<Ticket> {
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundException('Không tìm thấy yêu cầu hỗ trợ.');

    if (requester.isAdmin) return ticket;

    const email = requester.email?.trim().toLowerCase();
    if (!email || ticket.customerEmail?.trim().toLowerCase() !== email) {
      throw new ForbiddenException('Yêu cầu hỗ trợ này không thuộc về bạn.');
    }

    return ticket;
  }

  async create(
    createTicketDto: CreateTicketDto,
    clientIp?: string,
  ): Promise<Ticket> {
    await this.assertNotSpam(createTicketDto, clientIp);

    const created = await this.ticketRepository.create({
      // Assigned below, once the row has an id to derive it from.
      ticketNumber: null,
      customerEmail: createTicketDto.customerEmail,
      subject: createTicketDto.subject,
      description: createTicketDto.description,
      orderId: createTicketDto.orderId ?? null,
      deviceModel: createTicketDto.deviceModel ?? null,
      iccid: createTicketDto.iccid ?? null,
      planDestination: createTicketDto.planDestination ?? null,
      attachments: createTicketDto.attachments ?? null,
      status: TicketStatus.NEW,
      // Nothing has been resolved yet; the auto-close clock starts when it is.
      resolvedAt: null,
    });

    // The number is derived from the id, so it can only be assigned once the row
    // exists (#059).
    const ticketNumber = ticketNumberFor(Number(created.id));
    const ticket = (await this.ticketRepository.update(created.id, {
      ticketNumber,
    } as never)) ?? { ...created, ticketNumber };

    // The same acknowledgement, in the thread as well as in the inbox (#060).
    //
    // A partner raises support from the portal and watches the thread there, so
    // telling them only by email leaves the portal looking like nothing happened.
    // Written straight to the repository rather than through `addMessage`, which
    // would email an admin-authored message a second time.
    try {
      await this.messageRepository.save(
        this.messageRepository.create({
          ticketId: Number(ticket.id),
          authorRole: 'admin',
          authorName: 'Hệ thống',
          body: this.acknowledgementBody(ticketNumber),
          attachments: null,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Ticket ${ticketNumber}: could not post the acknowledgement to the thread — ${(err as Error).message}`,
      );
    }

    // Best-effort: the ticket itself is the record of the request, so a mail
    // outage must not lose a customer's support request.
    try {
      await this.mailService.sendTicketAcknowledgement({
        to: ticket.customerEmail,
        ticketNumber,
        ticketSubject: ticket.subject,
        ticketDescription: ticket.description,
      });
    } catch (err) {
      this.logger.error(
        `Ticket ${ticketNumber}: acknowledgement email failed — ${(err as Error).message}`,
      );
    }

    return ticket;
  }

  /**
   * The acknowledgement as it reads inside the thread (#060).
   *
   * Deliberately the same words as the email, so a partner comparing the two is
   * not left wondering whether they are about the same thing.
   */
  private acknowledgementBody(ticketNumber: string): string {
    return [
      'Cảm ơn bạn đã liên hệ với chúng tôi.',
      '',
      `Chúng tôi đã nhận được yêu cầu của bạn và đã tạo phiếu hỗ trợ ${ticketNumber}. Mã số phiếu này cũng có trong dòng tiêu đề email chúng tôi vừa gửi.`,
      '',
      'Đội ngũ của chúng tôi hiện đang xem xét yêu cầu của bạn và sẽ phản hồi lại bạn trong thời gian sớm nhất.',
      '',
      'Trân trọng,',
    ].join('\n');
  }

  /**
   * The checks the server enforces on the public support form (#033), cheapest
   * first. The browser runs its own friendlier versions; these are what stop a
   * script posting to the API directly.
   */
  private async assertNotSpam(
    dto: CreateTicketDto,
    clientIp?: string,
  ): Promise<void> {
    if (dto.website?.trim()) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { ticket: 'spamDetected' },
      });
    }

    if (clientIp) {
      const verdict = this.ipLimiter.hit(clientIp);
      if (!verdict.ok) throw tooManyTickets(verdict.retryAfterMs);
    }

    const since = new Date(Date.now() - TICKET_EMAIL_WINDOW_MS);
    const sentByEmail = await this.ticketRepository.countByEmailSince(
      dto.customerEmail,
      since,
    );
    if (sentByEmail >= TICKET_EMAIL_LIMIT) {
      throw tooManyTickets(TICKET_EMAIL_WINDOW_MS);
    }

    const duplicate = await this.ticketRepository.existsDuplicate({
      customerEmail: dto.customerEmail,
      subject: dto.subject,
      description: dto.description,
      since: new Date(Date.now() - TICKET_DUPLICATE_WINDOW_MS),
    });
    if (duplicate) {
      throw new ConflictException({
        status: HttpStatus.CONFLICT,
        errors: { ticket: 'duplicateTicket' },
      });
    }
  }

  findAllWithPagination({
    filterOptions,
    paginationOptions,
  }: {
    filterOptions?: {
      status?: string;
      search?: string;
      customerEmail?: string;
    } | null;
    paginationOptions: IPaginationOptions;
  }) {
    return this.ticketRepository.findManyWithPagination({
      filterOptions,
      paginationOptions,
    });
  }

  findById(id: Ticket['id']) {
    return this.ticketRepository.findById(id);
  }

  /**
   * Change a ticket's status (#061).
   *
   * `resolvedAt` is the clock the auto-close runs off, so it is stamped when the
   * ticket enters RESOLVED and cleared whenever it leaves — otherwise a ticket
   * reopened and resolved again would be closed against its first timestamp.
   */
  async updateStatus(id: Ticket['id'], status: string) {
    const resolvedAt = status === TicketStatus.RESOLVED ? new Date() : null;

    return this.ticketRepository.update(id, { status, resolvedAt } as never);
  }

  /**
   * What the CMS calls when an admin opens a ticket (#061).
   *
   * Opening the detail is the moment somebody actually picked the ticket up, so
   * NEW becomes IN_PROGRESS here. Only from NEW: a resolved or closed ticket an
   * admin merely re-reads must not be dragged back into the queue, and a reply is
   * what reopens one.
   */
  async findByIdForAdmin(id: Ticket['id']): Promise<Ticket | null> {
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket) return null;
    if (ticket.status !== TicketStatus.NEW) return ticket;

    const updated = await this.ticketRepository.update(id, {
      status: TicketStatus.IN_PROGRESS,
    } as never);

    return updated ?? { ...ticket, status: TicketStatus.IN_PROGRESS };
  }

  /**
   * Close the tickets that have sat resolved for the grace period, telling the
   * customer as it goes (#061).
   *
   * Hourly rather than by the minute: the window is 48 hours, so an hour's
   * resolution is far inside it and costs one indexed query per run.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async closeResolvedTickets(): Promise<number> {
    const cutoff = new Date(
      Date.now() - TICKET_AUTO_CLOSE_HOURS * 60 * 60 * 1000,
    );

    const due = await this.ticketRepository.findResolvedBefore(cutoff);
    if (!due.length) return 0;

    let closed = 0;
    for (const ticket of due) {
      try {
        await this.ticketRepository.update(ticket.id, {
          status: TicketStatus.CLOSED,
        } as never);
        closed += 1;
      } catch (err) {
        this.logger.error(
          `Ticket ${ticket.ticketNumber ?? ticket.id}: could not auto-close — ${(err as Error).message}`,
        );
        // Not notified: the status did not actually change, so saying it did
        // would be a lie to the customer.
        continue;
      }

      await this.notifyResolved(ticket);
    }

    if (closed > 0) {
      this.logger.log(
        `Auto-closed ${closed} ticket(s) resolved more than ${TICKET_AUTO_CLOSE_HOURS}h ago`,
      );
    }

    return closed;
  }

  /**
   * The "we marked this resolved" notice, by email and in the thread (#061).
   *
   * In the thread as well as the inbox because a partner follows their ticket in
   * the portal (#060), and best-effort on both halves: the ticket is already
   * closed, and a mail outage must not undo that or stop the rest of the sweep.
   */
  private async notifyResolved(ticket: Ticket): Promise<void> {
    const ticketNumber =
      ticket.ticketNumber ?? ticketNumberFor(Number(ticket.id));

    try {
      await this.messageRepository.save(
        this.messageRepository.create({
          ticketId: Number(ticket.id),
          authorRole: 'admin',
          authorName: 'Hệ thống',
          body: this.resolvedNoticeBody(),
          attachments: null,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Ticket ${ticketNumber}: could not post the close notice to the thread — ${(err as Error).message}`,
      );
    }

    if (!ticket.customerEmail) return;

    try {
      await this.mailService.sendTicketResolved({
        to: ticket.customerEmail,
        ticketNumber,
        ticketSubject: ticket.subject,
      });
    } catch (err) {
      this.logger.error(
        `Ticket ${ticketNumber}: close notice email failed — ${(err as Error).message}`,
      );
    }
  }

  /** The close notice as it reads in the thread; same words as the email. */
  private resolvedNoticeBody(): string {
    return [
      'Chào bạn,',
      '',
      'Chúng tôi đã đánh dấu yêu cầu của bạn là "Đã giải quyết". Chúng tôi luôn nỗ lực cải thiện sản phẩm và dịch vụ, và những phản hồi của bạn đóng vai trò vô cùng quan trọng đối với chúng tôi.',
      '',
      'Chúng tôi rất mong được tiếp tục hỗ trợ bạn duy trì kết nối trong những chuyến đi sắp tới. Nếu có bất kỳ thắc mắc nào, xin đừng ngần ngại liên hệ với chúng tôi bất cứ lúc nào.',
      '',
      'Trân trọng,',
    ].join('\n');
  }

  remove(id: Ticket['id']) {
    return this.ticketRepository.remove(id);
  }
}

function tooManyTickets(retryAfterMs: number): HttpException {
  return new HttpException(
    {
      status: HttpStatus.TOO_MANY_REQUESTS,
      errors: { ticket: 'tooManyTickets' },
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
