import { Module } from '@nestjs/common';
import { FooterRepository } from '../footer.repository';
import { FooterRelationalRepository } from './repositories/footer.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FooterEntity } from './entities/footer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FooterEntity])],
  providers: [
    {
      provide: FooterRepository,
      useClass: FooterRelationalRepository,
    },
  ],
  exports: [FooterRepository],
})
export class RelationalFooterPersistenceModule {}
