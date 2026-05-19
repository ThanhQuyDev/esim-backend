import { Injectable } from '@nestjs/common';
import { CreateTopBarDto } from './dto/create-top-bar.dto';
import { UpdateTopBarDto } from './dto/update-top-bar.dto';
import { TopBarRepository } from './infrastructure/persistence/top-bar.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { TopBar } from './domain/top-bar';

@Injectable()
export class TopBarsService {
  constructor(
    // Dependencies here
    private readonly topBarRepository: TopBarRepository,
  ) {}

  async create(createTopBarDto: CreateTopBarDto) {
    // Do not remove comment below.
    // <creating-property />

    return this.topBarRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      url: createTopBarDto.url,

      buttonContent: createTopBarDto.buttonContent,

      title: createTopBarDto.title,

      language: createTopBarDto.language,

      icon: createTopBarDto.icon ?? null,
    });
  }

  findAllWithPagination({
    paginationOptions,
    lang,
  }: {
    paginationOptions: IPaginationOptions;
    lang?: string;
  }) {
    return this.topBarRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      lang,
    });
  }

  findById(id: TopBar['id']) {
    return this.topBarRepository.findById(id);
  }

  findByIds(ids: TopBar['id'][]) {
    return this.topBarRepository.findByIds(ids);
  }

  async update(
    id: TopBar['id'],

    updateTopBarDto: UpdateTopBarDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.topBarRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      url: updateTopBarDto.url,

      buttonContent: updateTopBarDto.buttonContent,

      title: updateTopBarDto.title,

      language: updateTopBarDto.language,

      icon: updateTopBarDto.icon,
    });
  }

  remove(id: TopBar['id']) {
    return this.topBarRepository.remove(id);
  }
}
