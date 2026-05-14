import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateSeoConfigDto } from './dto/create-seo-config.dto';
import { UpdateSeoConfigDto } from './dto/update-seo-config.dto';
import { NullableType } from '../utils/types/nullable.type';
import {
  FilterSeoConfigDto,
  SortSeoConfigDto,
} from './dto/query-seo-config.dto';
import { SeoConfigRepository } from './infrastructure/persistence/seo-config.repository';
import { SeoConfig } from './domain/seo-config';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class SeoConfigsService {
  constructor(private readonly seoConfigsRepository: SeoConfigRepository) {}

  async create(createSeoConfigDto: CreateSeoConfigDto): Promise<SeoConfig> {
    const existingByUrl = await this.seoConfigsRepository.findByUrl(
      createSeoConfigDto.url,
    );
    if (existingByUrl) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          url: 'urlAlreadyExists',
        },
      });
    }

    return this.seoConfigsRepository.create({
      url: createSeoConfigDto.url,
      metaTitle: createSeoConfigDto.metaTitle ?? null,
      metaDescription: createSeoConfigDto.metaDescription ?? null,
      metaKeywords: createSeoConfigDto.metaKeywords ?? null,
      ogImage: createSeoConfigDto.ogImage ?? null,
      ogTitle: createSeoConfigDto.ogTitle ?? null,
      ogDescription: createSeoConfigDto.ogDescription ?? null,
      destinationId: createSeoConfigDto.destinationId ?? null,
      regionId: createSeoConfigDto.regionId ?? null,
      planId: createSeoConfigDto.planId ?? null,
      isActive: createSeoConfigDto.isActive ?? true,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterSeoConfigDto | null;
    sortOptions?: SortSeoConfigDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[SeoConfig[], number]> {
    return this.seoConfigsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: SeoConfig['id']): Promise<NullableType<SeoConfig>> {
    return this.seoConfigsRepository.findById(id);
  }

  findByUrl(url: SeoConfig['url']): Promise<NullableType<SeoConfig>> {
    return this.seoConfigsRepository.findByUrl(url);
  }

  async update(
    id: SeoConfig['id'],
    updateSeoConfigDto: UpdateSeoConfigDto,
  ): Promise<SeoConfig | null> {
    if (updateSeoConfigDto.url) {
      const existingByUrl = await this.seoConfigsRepository.findByUrl(
        updateSeoConfigDto.url,
      );
      if (existingByUrl && existingByUrl.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            url: 'urlAlreadyExists',
          },
        });
      }
    }

    return this.seoConfigsRepository.update(id, {
      url: updateSeoConfigDto.url,
      metaTitle: updateSeoConfigDto.metaTitle,
      metaDescription: updateSeoConfigDto.metaDescription,
      metaKeywords: updateSeoConfigDto.metaKeywords,
      ogImage: updateSeoConfigDto.ogImage,
      ogTitle: updateSeoConfigDto.ogTitle,
      ogDescription: updateSeoConfigDto.ogDescription,
      destinationId: updateSeoConfigDto.destinationId,
      regionId: updateSeoConfigDto.regionId,
      planId: updateSeoConfigDto.planId,
      isActive: updateSeoConfigDto.isActive,
    });
  }

  async remove(id: SeoConfig['id']): Promise<void> {
    await this.seoConfigsRepository.remove(id);
  }
}
