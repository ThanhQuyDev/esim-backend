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
    filterOptions?: {
      status?: string;
      search?: string;
      customerEmail?: string;
    } | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Ticket[], number]>;

  abstract findById(id: Ticket['id']): Promise<NullableType<Ticket>>;

  /** Tickets opened with this email since `since` — the per-email spam limit (#033). */
  abstract countByEmailSince(email: string, since: Date): Promise<number>;

  /** Whether the exact same request was already filed since `since` (#033). */
  abstract existsDuplicate(input: {
    customerEmail: string;
    subject: string;
    description: string;
    since: Date;
  }): Promise<boolean>;

  abstract update(
    id: Ticket['id'],
    payload: Partial<Ticket>,
  ): Promise<Ticket | null>;

  abstract remove(id: Ticket['id']): Promise<void>;
}
