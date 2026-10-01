import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * An extra note shown under one brand on the supported-devices page (#079).
 *
 * The page could only ever show one note: a single string in the storefront's
 * locale file, hard-coded to appear under "iPhone". Any other brand that needs a
 * caveat — a Samsung model sold locked to a carrier, say — had nowhere to put it,
 * and changing the iPhone wording meant a deploy.
 *
 * Kept in its own table rather than as a column on `supported_device`: a note
 * belongs to a brand, not to each of its ~340 models, and unlike a device name it
 * has to exist in both languages.
 */
@Entity({ name: 'manufacturer_note' })
@Unique('UQ_manufacturer_note_brand_language', ['manufacturer', 'language'])
export class ManufacturerNoteEntity extends EntityRelationalHelper {
  /** Brand name, matching `supported_device.manufacturer` exactly. */
  @Index()
  @Column({ nullable: false, type: String })
  manufacturer: string;

  @Index()
  @Column({ nullable: false, type: String, default: 'vi' })
  language: string;

  /** `text`, because these run to a few sentences. */
  @Column({ nullable: false, type: 'text' })
  note: string;

  /** Off hides the note without losing the wording. */
  @Index()
  @Column({ nullable: false, type: Boolean, default: true })
  isActive: boolean;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
