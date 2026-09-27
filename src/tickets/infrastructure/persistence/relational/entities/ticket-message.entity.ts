import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { TicketEntity } from './ticket.entity';

/** Who wrote a message in a ticket thread (#032). */
export type TicketMessageAuthorRole = 'customer' | 'admin';

@Entity({ name: 'ticket_message' })
export class TicketMessageEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: Number })
  ticketId: number;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket?: TicketEntity;

  /** `customer` covers partners too — they write as the ticket's owner. */
  @Column({ type: String })
  authorRole: TicketMessageAuthorRole;

  @Column({ type: String, nullable: true })
  authorName: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
