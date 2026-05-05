import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { HeroBannersService } from './hero-banners.service';
import { HeroBannersController } from './hero-banners.controller';
import { RelationalHeroBannerPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    // do not remove this comment
    RelationalHeroBannerPersistenceModule,
  ],
  controllers: [HeroBannersController],
  providers: [HeroBannersService],
  exports: [HeroBannersService, RelationalHeroBannerPersistenceModule],
})
export class HeroBannersModule {}
