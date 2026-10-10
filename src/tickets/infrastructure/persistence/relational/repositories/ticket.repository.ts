import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { TicketEntity } from '../entities/ticket.entity';
import { TicketStatus } from '../../../../ticket-status';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Ticket } from '../../../../domain/ticket';
import { TicketRepository } from '../../ticket.repository';
import { TicketMapper } from '../mappers/ticket.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class TicketsRelationalRepository implements TicketRepository {
  constructor(
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
  ) {}

  async create(data: Ticket): Promise<Ticket> {
    const persistenceModel = TicketMapper.toPersistence(data);
    const newEntity = await this.ticketsRepository.save(
      this.ticketsRepository.create(persistenceModel),
    );
    return TicketMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    paginationOptions,
  }: {
    filterOptions?: {
      status?: string;
      search?: string;
      customerEmail?: string;
      /** Waiting on support: new, or the customer wrote last and it is not closed. */
      awaitingSupport?: boolean;
    } | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Ticket[], number]> {
    const qb = this.ticketsRepository.createQueryBuilder('ticket');

    // Scoping filter for the non-admin listing — see TicketsController.findMine.
    if (filterOptions?.customerEmail) {
      qb.andWhere('LOWER(ticket."customerEmail") = LOWER(:customerEmail)', {
        customerEmail: filterOptions.customerEmail,
      });
    }

    if (filterOptions?.status) {
      qb.andWhere('ticket.status = :status', {
        status: filterOptions.status,
      });
    }

    if (filterOptions?.search) {
      qb.andWhere(
        '(ticket."customerEmail" ILIKE :search OR ticket.subject ILIKE :search)',
        { search: `%${filterOptions.search}%` },
      );
    }

    // The sidebar badge (#041, test round 4): a ticket whose last message is the
    // customer's still needs an answer, whatever status it is in — short of
    // closed, which a customer's mail can no longer reopen.
    if (filterOptions?.awaitingSupport) {
      qb.andWhere(
        `(ticket.status = 'open' OR (ticket."lastReplyRole" = 'customer' AND ticket.status <> 'closed'))`,
      );
    }

    qb.orderBy('ticket.createdAt', 'DESC');
    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();
    return [entities.map((entity) => TicketMapper.toDomain(entity)), count];
  }

  async isPartnerEmail(email: string): Promise<boolean> {
    const rows: unknown[] = await this.ticketsRepository.query(
      `SELECT 1 FROM "partner" p
         JOIN "user" u ON u.id = p."userId"
        WHERE LOWER(u.email) = LOWER($1)
        LIMIT 1`,
      [email.trim()],
    );
    return rows.length > 0;
  }

  async findById(id: Ticket['id']): Promise<NullableType<Ticket>> {
    const entity = await this.ticketsRepository.findOne({ where: { id } });
    return entity ? TicketMapper.toDomain(entity) : null;
  }

  async findByTicketNumber(
    ticketNumber: string,
  ): Promise<NullableType<Ticket>> {
    const entity = await this.ticketsRepository.findOne({
      where: { ticketNumber },
    });
    return entity ? TicketMapper.toDomain(entity) : null;
  }

  /**
   * Resolved tickets past their grace period (#061).
   *
   * `resolvedAt IS NOT NULL` matters: a row that somehow sits in `resolved`
   * without a timestamp has no clock to measure, and closing it immediately would
   * be guessing.
   */
  async findResolvedBefore(cutoff: Date): Promise<Ticket[]> {
    const entities = await this.ticketsRepository.find({
      where: {
        status: TicketStatus.RESOLVED,
        resolvedAt: LessThan(cutoff),
      },
      order: { resolvedAt: 'ASC' },
    });
    return entities.map((entity) => TicketMapper.toDomain(entity));
  }

  async countByEmailSince(email: string, since: Date): Promise<number> {
    return this.ticketsRepository
      .createQueryBuilder('ticket')
      .where('LOWER(ticket."customerEmail") = LOWER(:email)', { email })
      .andWhere('ticket.createdAt >= :since', { since })
      .getCount();
  }

  async existsDuplicate(input: {
    customerEmail: string;
    subject: string;
    description: string;
    since: Date;
  }): Promise<boolean> {
    const count = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .where('LOWER(ticket."customerEmail") = LOWER(:email)', {
        email: input.customerEmail,
      })
      .andWhere('LOWER(TRIM(ticket.subject)) = LOWER(TRIM(:subject))', {
        subject: input.subject,
      })
      .andWhere('LOWER(TRIM(ticket.description)) = LOWER(TRIM(:description))', {
        description: input.description,
      })
      .andWhere('ticket.createdAt >= :since', { since: input.since })
      .getCount();
    return count > 0;
  }

  async update(
    id: Ticket['id'],
    payload: Partial<Ticket>,
  ): Promise<Ticket | null> {
    const entity = await this.ticketsRepository.findOne({ where: { id } });
    if (!entity) return null;

    const updated = await this.ticketsRepository.save(
      this.ticketsRepository.create(
        TicketMapper.toPersistence({
          ...TicketMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );
    return TicketMapper.toDomain(updated);
  }

  async remove(id: Ticket['id']): Promise<void> {
    await this.ticketsRepository.delete(id);
  }
}
