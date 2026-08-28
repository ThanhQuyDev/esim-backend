import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorsService } from './authors.service';
import { AuthorProfileEntity } from './infrastructure/persistence/relational/entities/author-profile.entity';
import { AuthorProfileRepository } from './infrastructure/persistence/relational/repositories/author-profile.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AuthorProfileEntity])],
  providers: [AuthorsService, AuthorProfileRepository],
  exports: [AuthorsService, TypeOrmModule],
})
export class AuthorsModule {}
