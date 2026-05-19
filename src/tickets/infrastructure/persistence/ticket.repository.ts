import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { Ticket } from '../../domain/ticket';

export abstract class TicketRepository {
  abstract create(
    data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Ticket>;

  abstract findManyWithPagination({
    filterOptions,
    paginationOptions,
  }: {
    filterOptions?: { status?: string; search?: string } | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Ticket[], number]>;

  abstract findById(id: Ticket['id']): Promise<NullableType<Ticket>>;

  abstract update(
    id: Ticket['id'],
    payload: Partial<Ticket>,
  ): Promise<Ticket | null>;

  abstract remove(id: Ticket['id']): Promise<void>;
}
