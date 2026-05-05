import { FilesService } from '../files/files.service';
import { FileType } from '../files/domain/file';

import {
  // common
  Injectable,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateTopBarDto } from './dto/create-top-bar.dto';
import { UpdateTopBarDto } from './dto/update-top-bar.dto';
import { TopBarRepository } from './infrastructure/persistence/top-bar.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { TopBar } from './domain/top-bar';

@Injectable()
export class TopBarsService {
  constructor(
    private readonly fileService: FilesService,

    // Dependencies here
    private readonly topBarRepository: TopBarRepository,
  ) {}

  async create(createTopBarDto: CreateTopBarDto) {
    // Do not remove comment below.
    // <creating-property />

    let icon: FileType | null | undefined = undefined;

    if (createTopBarDto.icon) {
      const iconObject = await this.fileService.findById(
        createTopBarDto.icon.id,
      );
      if (!iconObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            icon: 'notExists',
          },
        });
      }
      icon = iconObject;
    } else if (createTopBarDto.icon === null) {
      icon = null;
    }

    return this.topBarRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      url: createTopBarDto.url,

      buttonContent: createTopBarDto.buttonContent,

      title: createTopBarDto.title,

      language: createTopBarDto.language,

      icon,
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

    let icon: FileType | null | undefined = undefined;

    if (updateTopBarDto.icon) {
      const iconObject = await this.fileService.findById(
        updateTopBarDto.icon.id,
      );
      if (!iconObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            icon: 'notExists',
          },
        });
      }
      icon = iconObject;
    } else if (updateTopBarDto.icon === null) {
      icon = null;
    }

    return this.topBarRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      url: updateTopBarDto.url,

      buttonContent: updateTopBarDto.buttonContent,

      title: updateTopBarDto.title,

      language: updateTopBarDto.language,

      icon,
    });
  }

  remove(id: TopBar['id']) {
    return this.topBarRepository.remove(id);
  }
}
