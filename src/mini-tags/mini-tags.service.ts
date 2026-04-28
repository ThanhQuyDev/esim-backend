import { Injectable } from '@nestjs/common';
import { CreateMiniTagDto } from './dto/create-mini-tag.dto';
import { UpdateMiniTagDto } from './dto/update-mini-tag.dto';
import { MiniTagRepository } from './infrastructure/persistence/mini-tag.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { MiniTag } from './domain/mini-tag';

@Injectable()
export class MiniTagsService {
  constructor(private readonly miniTagRepository: MiniTagRepository) {}

  async create(createMiniTagDto: CreateMiniTagDto) {
    return this.miniTagRepository.create({
      image: createMiniTagDto.image,
      title: createMiniTagDto.title,
      description: createMiniTagDto.description,
      contentButton: createMiniTagDto.contentButton,
      linkUrl: createMiniTagDto.linkUrl,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.miniTagRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: MiniTag['id']) {
    return this.miniTagRepository.findById(id);
  }

  findByIds(ids: MiniTag['id'][]) {
    return this.miniTagRepository.findByIds(ids);
  }

  async update(id: MiniTag['id'], updateMiniTagDto: UpdateMiniTagDto) {
    return this.miniTagRepository.update(id, {
      image: updateMiniTagDto.image,
      title: updateMiniTagDto.title,
      description: updateMiniTagDto.description,
      contentButton: updateMiniTagDto.contentButton,
      linkUrl: updateMiniTagDto.linkUrl,
    });
  }

  remove(id: MiniTag['id']) {
    return this.miniTagRepository.remove(id);
  }
}
