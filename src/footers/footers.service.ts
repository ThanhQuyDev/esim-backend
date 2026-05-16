import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateFooterDto } from './dto/create-footer.dto';
import { UpdateFooterDto } from './dto/update-footer.dto';
import { FooterRepository } from './infrastructure/persistence/footer.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Footer } from './domain/footer';
import { FilterFooterDto, SortFooterDto } from './dto/find-all-footers.dto';

@Injectable()
export class FootersService {
  constructor(
    // Dependencies here
    private readonly footerRepository: FooterRepository,
  ) {}

  async create(createFooterDto: CreateFooterDto) {
    // Do not remove comment below.
    // <creating-property />

    return this.footerRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      categories: createFooterDto.categories,

      url: createFooterDto.url,

      title: createFooterDto.title,

      titleVi: createFooterDto.titleVi,
    });
  }

  findAllWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterFooterDto | null;
    sortOptions?: SortFooterDto[] | null;
    paginationOptions: IPaginationOptions;
  }) {
    return this.footerRepository.findAllWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Footer['id']) {
    return this.footerRepository.findById(id);
  }

  findByIds(ids: Footer['id'][]) {
    return this.footerRepository.findByIds(ids);
  }

  async update(
    id: Footer['id'],

    updateFooterDto: UpdateFooterDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.footerRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      categories: updateFooterDto.categories,

      url: updateFooterDto.url,

      title: updateFooterDto.title,

      titleVi: updateFooterDto.titleVi,
    });
  }

  remove(id: Footer['id']) {
    return this.footerRepository.remove(id);
  }
}
