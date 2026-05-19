import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketEntity } from '../entities/ticket.entity';
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
    filterOptions?: { status?: string; search?: string } | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Ticket[], number]> {
    const qb = this.ticketsRepository.createQueryBuilder('ticket');

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

    qb.orderBy('ticket.createdAt', 'DESC');
    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    const [entities, count] = await qb.getManyAndCount();
    return [entities.map((entity) => TicketMapper.toDomain(entity)), count];
  }

  async findById(id: Ticket['id']): Promise<NullableType<Ticket>> {
    const entity = await this.ticketsRepository.findOne({ where: { id } });
    return entity ? TicketMapper.toDomain(entity) : null;
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
