import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqRepository } from './infrastructure/persistence/faq.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Faq } from './domain/faq';

@Injectable()
export class FaqsService {
  constructor(
    // Dependencies here
    private readonly faqRepository: FaqRepository,
  ) {}

  async create(createFaqDto: CreateFaqDto) {
    // Do not remove comment below.
    // <creating-property />

    return this.faqRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      language: createFaqDto.language,

      isActive: createFaqDto.isActive,

      sortOrder: createFaqDto.sortOrder,

      answer: createFaqDto.answer,

      question: createFaqDto.question,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.faqRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Faq['id']) {
    return this.faqRepository.findById(id);
  }

  findByIds(ids: Faq['id'][]) {
    return this.faqRepository.findByIds(ids);
  }

  async update(
    id: Faq['id'],

    updateFaqDto: UpdateFaqDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.faqRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      language: updateFaqDto.language,

      isActive: updateFaqDto.isActive,

      sortOrder: updateFaqDto.sortOrder,

      answer: updateFaqDto.answer,

      question: updateFaqDto.question,
    });
  }

  remove(id: Faq['id']) {
    return this.faqRepository.remove(id);
  }
}
