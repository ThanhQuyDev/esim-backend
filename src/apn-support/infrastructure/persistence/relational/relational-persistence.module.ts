import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApnSupportRepository } from '../apn-support.repository';
import { ApnSupportRelationalRepository } from './repositories/apn-support.repository';
import { ApnSupportEntity } from './entities/apn-support.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApnSupportEntity])],
  providers: [
    {
      provide: ApnSupportRepository,
      useClass: ApnSupportRelationalRepository,
    },
  ],
  exports: [ApnSupportRepository],
})
export class RelationalApnSupportPersistenceModule {}
