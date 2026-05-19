import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({ name: 'ticket' })
export class TicketEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String })
  customerEmail: string;

  @Column({ type: String })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: String, nullable: true })
  orderId: string | null;

  @Column({ type: String, nullable: true })
  deviceModel: string | null;

  @Column({ type: String, nullable: true })
  iccid: string | null;

  @Column({ type: String, nullable: true })
  planDestination: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[] | null;

  @Column({ type: String, default: 'open' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
