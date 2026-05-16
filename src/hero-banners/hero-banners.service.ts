import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import { HeroBannerRepository } from './infrastructure/persistence/hero-banner.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { HeroBanner } from './domain/hero-banner';
import {
  FilterHeroBannerDto,
  SortHeroBannerDto,
} from './dto/find-all-hero-banners.dto';

@Injectable()
export class HeroBannersService {
  constructor(
    // Dependencies here
    private readonly heroBannerRepository: HeroBannerRepository,
  ) {}

  async create(createHeroBannerDto: CreateHeroBannerDto) {
    // Do not remove comment below.
    // <creating-property />

    return this.heroBannerRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      active: createHeroBannerDto.active,

      title: createHeroBannerDto.title,

      firstIcon: createHeroBannerDto.firstIcon,

      firstContent: createHeroBannerDto.firstContent,

      secondIcon: createHeroBannerDto.secondIcon,

      secondContent: createHeroBannerDto.secondContent,

      description: createHeroBannerDto.description,

      language: createHeroBannerDto.language,
    });
  }

  findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
    lang,
  }: {
    filterOptions?: FilterHeroBannerDto | null;
    sortOptions?: SortHeroBannerDto[] | null;
    paginationOptions: IPaginationOptions;
    lang?: string;
  }) {
    return this.heroBannerRepository.findAllWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      lang,
    });
  }

  findById(id: HeroBanner['id']) {
    return this.heroBannerRepository.findById(id);
  }

  findByIds(ids: HeroBanner['id'][]) {
    return this.heroBannerRepository.findByIds(ids);
  }

  async update(
    id: HeroBanner['id'],

    updateHeroBannerDto: UpdateHeroBannerDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.heroBannerRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      active: updateHeroBannerDto.active,

      title: updateHeroBannerDto.title,

      firstIcon: updateHeroBannerDto.firstIcon,

      firstContent: updateHeroBannerDto.firstContent,

      secondIcon: updateHeroBannerDto.secondIcon,

      secondContent: updateHeroBannerDto.secondContent,

      description: updateHeroBannerDto.description,

      language: updateHeroBannerDto.language,
    });
  }

  remove(id: HeroBanner['id']) {
    return this.heroBannerRepository.remove(id);
  }
}
