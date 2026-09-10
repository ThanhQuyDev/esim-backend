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
import { PartnerLinkEntity } from './partner-link.entity';

/**
 * The attribution window asks for the newest click on a link while an order is
 * being created, so that lookup gets its own composite index (#095) — see
 * migration `1788025800000`.
 */
@Index(['linkId', 'clickedAt'])
@Entity({ name: 'partner_link_click' })
export class PartnerLinkClickEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  linkId!: number;

  @ManyToOne(() => PartnerLinkEntity)
  @JoinColumn({ name: 'linkId' })
  link?: PartnerLinkEntity;

  @Column({ type: String, nullable: true })
  ipHash?: string | null;

  @Column({ type: String, nullable: true })
  userAgent?: string | null;

  @Column({ type: String, nullable: true })
  referrer?: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  visitorId?: string | null;

  @CreateDateColumn()
  clickedAt!: Date;
}
