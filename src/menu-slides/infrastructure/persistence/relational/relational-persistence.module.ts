import { Module } from '@nestjs/common';
import { MenuSlideRepository } from '../menu-slide.repository';
import { MenuSlideRelationalRepository } from './repositories/menu-slide.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuSlideEntity } from './entities/menu-slide.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MenuSlideEntity])],
  providers: [
    {
      provide: MenuSlideRepository,
      useClass: MenuSlideRelationalRepository,
    },
  ],
  exports: [MenuSlideRepository],
})
export class RelationalMenuSlidePersistenceModule {}
