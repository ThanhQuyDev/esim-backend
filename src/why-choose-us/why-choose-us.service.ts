import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateWhyChooseUsDto } from './dto/create-why-choose-us.dto';
import { UpdateWhyChooseUsDto } from './dto/update-why-choose-us.dto';
import { WhyChooseUsRepository } from './infrastructure/persistence/why-choose-us.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { WhyChooseUs } from './domain/why-choose-us';
import {
  FilterWhyChooseUsDto,
  SortWhyChooseUsDto,
} from './dto/find-all-why-choose-us.dto';

@Injectable()
export class WhyChooseUsService {
  constructor(
    // Dependencies here
    private readonly whyChooseUsRepository: WhyChooseUsRepository,
  ) {}

  async create(createWhyChooseUsDto: CreateWhyChooseUsDto) {
    // Do not remove comment below.
    // <creating-property />

    return this.whyChooseUsRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      language: createWhyChooseUsDto.language,

      isActive: createWhyChooseUsDto.isActive,

      sortOrder: createWhyChooseUsDto.sortOrder,

      icon: createWhyChooseUsDto.icon,

      description: createWhyChooseUsDto.description,

      title: createWhyChooseUsDto.title,
    });
  }

  findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterWhyChooseUsDto | null;
    sortOptions?: SortWhyChooseUsDto[] | null;
    paginationOptions: IPaginationOptions;
  }) {
    return this.whyChooseUsRepository.findAllWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: WhyChooseUs['id']) {
    return this.whyChooseUsRepository.findById(id);
  }

  findByIds(ids: WhyChooseUs['id'][]) {
    return this.whyChooseUsRepository.findByIds(ids);
  }

  async update(
    id: WhyChooseUs['id'],

    updateWhyChooseUsDto: UpdateWhyChooseUsDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.whyChooseUsRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      language: updateWhyChooseUsDto.language,

      isActive: updateWhyChooseUsDto.isActive,

      sortOrder: updateWhyChooseUsDto.sortOrder,

      icon: updateWhyChooseUsDto.icon,

      description: updateWhyChooseUsDto.description,

      title: updateWhyChooseUsDto.title,
    });
  }

  remove(id: WhyChooseUs['id']) {
    return this.whyChooseUsRepository.remove(id);
  }
}
