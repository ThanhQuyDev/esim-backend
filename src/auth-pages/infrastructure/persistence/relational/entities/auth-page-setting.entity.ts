import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * Branding of a sign-in page, one row per deployment (#006).
 *
 * The admin console and the partner portal are the same app deployed twice, and
 * both shipped the starter kit's placeholder — a generic "Logo" glyph and a
 * testimonial from "Random Dude" — which partners were seeing on the page where
 * they first meet esim.vn. Every field is editable from the CMS so the copy can
 * be fixed without a deploy.
 */
@Entity({ name: 'auth_page_setting' })
export class AuthPageSettingEntity extends EntityRelationalHelper {
  /** `admin` or `partner`, matching the frontend's APP_MODE. */
  @PrimaryColumn({ type: String, length: 16 })
  mode: string;

  /** Logo image. Empty falls back to {@link logoText} beside the default mark. */
  @Column({ type: String, length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: String, length: 120, nullable: true })
  logoText: string | null;

  /** Background of the left panel. Empty keeps the animated grid pattern. */
  @Column({ type: String, length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: String, length: 500, nullable: true })
  quote: string | null;

  @Column({ type: String, length: 120, nullable: true })
  quoteAuthor: string | null;

  @Column({ type: String, length: 120, nullable: true })
  heading: string | null;

  @Column({ type: String, length: 300, nullable: true })
  subheading: string | null;

  /**
   * Where "Đăng ký" on the sign-in page leads (#016, test round 4) — on the
   * partner portal, the partner application form. Empty uses the built-in one.
   */
  @Column({ type: String, length: 500, nullable: true })
  signUpUrl: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
