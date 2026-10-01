import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/** One third-party snippet injected on every page of the storefront (#075). */
@Entity({ name: 'site_script' })
export class SiteScriptEntity extends EntityRelationalHelper {
  /** What this snippet is, for the admin list — "GA4", "Tag Manager", … */
  @Column({ nullable: false, type: String })
  name: string;

  /**
   * The snippet exactly as the vendor gives it. `text` because a Tag Manager
   * block runs to several KB, and stored verbatim because rewriting a pasted
   * script is how you break it.
   */
  @Column({ nullable: false, type: 'text' })
  content: string;

  /** 'head' or 'bodyEnd'. */
  @Index()
  @Column({ nullable: false, type: String, default: 'head' })
  placement: string;

  /**
   * Off removes the snippet from the site without losing it — the usual reason
   * being that a tag has to be pulled quickly without waiting for a deploy.
   */
  @Index()
  @Column({ nullable: false, type: Boolean, default: true })
  isActive: boolean;

  /**
   * Order within a placement. It matters: a gtag config call has to come after
   * the loader it configures.
   */
  @Column({ nullable: false, type: 'int', default: 0 })
  sortOrder: number;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
