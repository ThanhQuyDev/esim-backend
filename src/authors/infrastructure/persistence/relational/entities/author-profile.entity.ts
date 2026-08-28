import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({ name: 'author_profile' })
export class AuthorProfileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: Number })
  userId: number;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ type: String })
  name: string;

  @Index({ unique: true })
  @Column({ type: String })
  slug: string;

  @Column({ type: String, nullable: true })
  avatar?: string | null;

  @Column({ type: String, nullable: true })
  description?: string | null;
}
