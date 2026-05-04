import { FilesService } from '../files/files.service';
import { FileType } from '../files/domain/file';

import {
  // common
  Injectable,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import { HeroBannerRepository } from './infrastructure/persistence/hero-banner.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { HeroBanner } from './domain/hero-banner';

@Injectable()
export class HeroBannersService {
  constructor(
    private readonly fileService: FilesService,

    // Dependencies here
    private readonly heroBannerRepository: HeroBannerRepository,
  ) {}

  async create(createHeroBannerDto: CreateHeroBannerDto) {
    // Do not remove comment below.
    // <creating-property />

    let image: FileType | null | undefined = undefined;

    if (createHeroBannerDto.image) {
      const imageObject = await this.fileService.findById(
        createHeroBannerDto.image.id,
      );
      if (!imageObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            image: 'notExists',
          },
        });
      }
      image = imageObject;
    } else if (createHeroBannerDto.image === null) {
      image = null;
    }

    return this.heroBannerRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      active: createHeroBannerDto.active,

      image,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.heroBannerRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
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

    let image: FileType | null | undefined = undefined;

    if (updateHeroBannerDto.image) {
      const imageObject = await this.fileService.findById(
        updateHeroBannerDto.image.id,
      );
      if (!imageObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            image: 'notExists',
          },
        });
      }
      image = imageObject;
    } else if (updateHeroBannerDto.image === null) {
      image = null;
    }

    return this.heroBannerRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      active: updateHeroBannerDto.active,

      image,
    });
  }

  remove(id: HeroBanner['id']) {
    return this.heroBannerRepository.remove(id);
  }
}
