import { Module } from '@nestjs/common';
import { MiniTagRepository } from '../mini-tag.repository';
import { MiniTagRelationalRepository } from './repositories/mini-tag.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MiniTagEntity } from './entities/mini-tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MiniTagEntity])],
  providers: [
    {
      provide: MiniTagRepository,
      useClass: MiniTagRelationalRepository,
    },
  ],
  exports: [MiniTagRepository],
})
export class RelationalMiniTagPersistenceModule {}
