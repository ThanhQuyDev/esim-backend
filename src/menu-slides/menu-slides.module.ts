import { Module } from '@nestjs/common';
import { MenuSlidesService } from './menu-slides.service';
import { MenuSlidesController } from './menu-slides.controller';
import { RelationalMenuSlidePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalMenuSlidePersistenceModule],
  controllers: [MenuSlidesController],
  providers: [MenuSlidesService],
  exports: [MenuSlidesService, RelationalMenuSlidePersistenceModule],
})
export class MenuSlidesModule {}
