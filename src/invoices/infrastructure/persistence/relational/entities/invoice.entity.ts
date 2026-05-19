import { OrderEntity } from '../../../../../orders/infrastructure/persistence/relational/entities/order.entity';

import {
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { InvoiceStatus } from '../../../../invoices.enum';

@Entity({
  name: 'invoice',
})
export class InvoiceEntity extends EntityRelationalHelper {
  @Index()
  @Column({
    nullable: false,
    type: String,
    default: InvoiceStatus.PENDING,
  })
  status: string;

  @Column({
    nullable: false,
    type: String,
  })
  invoiceEmail: string;

  @Column({
    nullable: false,
    type: String,
  })
  address: string;

  @Column({
    nullable: false,
    type: String,
  })
  taxCode: string;

  @Column({
    nullable: false,
    type: String,
  })
  companyName: string;

  @Index({ unique: true })
  @Column({ type: Number, nullable: false })
  orderId: number;

  @OneToOne(() => OrderEntity, { eager: true, nullable: false })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
