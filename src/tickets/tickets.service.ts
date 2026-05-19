import { Injectable } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketRepository } from './infrastructure/persistence/ticket.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Ticket } from './domain/ticket';

@Injectable()
export class TicketsService {
  constructor(private readonly ticketRepository: TicketRepository) {}

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
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

  findAllWithPagination({
    filterOptions,
    paginationOptions,
  }: {
    filterOptions?: { status?: string; search?: string } | null;
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
