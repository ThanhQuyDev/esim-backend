import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
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

@Injectable()
export class TicketsService {
  private readonly ipLimiter = new SlidingWindowLimiter(
    TICKET_IP_LIMIT,
    TICKET_IP_WINDOW_MS,
  );

  constructor(private readonly ticketRepository: TicketRepository) {}

  async create(
    createTicketDto: CreateTicketDto,
    clientIp?: string,
  ): Promise<Ticket> {
    await this.assertNotSpam(createTicketDto, clientIp);

    return this.ticketRepository.create({
      customerEmail: createTicketDto.customerEmail,
      subject: createTicketDto.subject,
      description: createTicketDto.description,
      orderId: createTicketDto.orderId ?? null,
      deviceModel: createTicketDto.deviceModel ?? null,
      iccid: createTicketDto.iccid ?? null,
      planDestination: createTicketDto.planDestination ?? null,
      attachments: createTicketDto.attachments ?? null,
      status: 'open',
    });
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

  async updateStatus(id: Ticket['id'], status: string) {
    return this.ticketRepository.update(id, { status });
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
