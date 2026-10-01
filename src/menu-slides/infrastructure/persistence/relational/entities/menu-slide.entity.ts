import {
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * One card in a mega-menu "Explore" carousel (#073).
 *
 * Stored per language rather than as a translation table, matching `top_bar` —
 * the other navbar carousel — so the two behave the same way in the CMS.
 */
@Entity({
  name: 'menu_slide',
})
export class MenuSlideEntity extends EntityRelationalHelper {
  /** Which dropdown panel this slide belongs to: product / resources / offers / help. */
  @Index()
  @Column({
    nullable: false,
    type: String,
  })
  menuKey: string;

  @Column({
    nullable: false,
    type: String,
  })
  title: string;

  @Column({
    nullable: false,
    type: String,
  })
  description: string;

  /** Where the card links to, as a path or absolute URL. */
  @Column({
    nullable: false,
    type: String,
  })
  href: string;

  @Column({
    nullable: false,
    type: String,
  })
  image: string;

  /**
   * Alt text. Nullable because an empty alt is the correct markup for a purely
   * decorative image, and forcing a value would get it filled with the title.
   */
  @Column({
    nullable: true,
    type: String,
  })
  imageAlt?: string | null;

  @Index()
  @Column({
    nullable: false,
    type: String,
    default: 'en',
  })
  language: string;

  /** Display order inside its panel; lower first. */
  @Column({
    nullable: false,
    type: 'int',
    default: 0,
  })
  sortOrder: number;

  /**
   * Off hides the slide without deleting it, so a seasonal card can be prepared
   * ahead of time or retired without losing its image and wording.
   */
  @Index()
  @Column({
    nullable: false,
    type: Boolean,
    default: true,
  })
  isActive: boolean;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
