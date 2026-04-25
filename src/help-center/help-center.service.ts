import { Injectable } from '@nestjs/common';
import { CreateHelpCenterDto } from './dto/create-help-center.dto';
import { UpdateHelpCenterDto } from './dto/update-help-center.dto';
import { HelpCenterRepository } from './infrastructure/persistence/help-center.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import {
  HelpCenter,
  HelpCenterCategory,
  HelpCenterParent,
} from './domain/help-center';

@Injectable()
export class HelpCenterService {
  constructor(private readonly helpCenterRepository: HelpCenterRepository) {}

  create(createDto: CreateHelpCenterDto) {
    return this.helpCenterRepository.create({
      title: createDto.title,
      content: createDto.content,
      order: createDto.order ?? 0,
      category: createDto.category,
      parent: createDto.parent,
    });
  }

  findAllWithPagination({
    paginationOptions,
    category,
    parent,
  }: {
    paginationOptions: IPaginationOptions;
    category?: HelpCenterCategory;
    parent?: HelpCenterParent;
  }) {
    return this.helpCenterRepository.findAllWithPagination({
      paginationOptions,
      category,
      parent,
    });
  }

  findById(id: HelpCenter['id']) {
    return this.helpCenterRepository.findById(id);
  }

  update(id: HelpCenter['id'], updateDto: UpdateHelpCenterDto) {
    return this.helpCenterRepository.update(id, {
      title: updateDto.title,
      content: updateDto.content,
      order: updateDto.order,
      category: updateDto.category,
      parent: updateDto.parent,
    });
  }

  remove(id: HelpCenter['id']) {
    return this.helpCenterRepository.remove(id);
  }
}
