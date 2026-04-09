import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BlogEntity } from '../entities/blog.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { Blog } from '../../../../domain/blog';
import { BlogRepository } from '../../blog.repository';
import { BlogMapper } from '../mappers/blog.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class BlogRelationalRepository implements BlogRepository {
  constructor(
    @InjectRepository(BlogEntity)
    private readonly blogRepository: Repository<BlogEntity>,
  ) {}

  async create(data: Blog): Promise<Blog> {
    const persistenceModel = BlogMapper.toPersistence(data);
    const newEntity = await this.blogRepository.save(
      this.blogRepository.create(persistenceModel),
    );
    return BlogMapper.toDomain(newEntity);
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Blog[]> {
    const entities = await this.blogRepository.find({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
    });

    return entities.map((entity) => BlogMapper.toDomain(entity));
  }

  async findById(id: Blog['id']): Promise<NullableType<Blog>> {
    const entity = await this.blogRepository.findOne({
      where: { id },
    });

    return entity ? BlogMapper.toDomain(entity) : null;
  }

  async findByIds(ids: Blog['id'][]): Promise<Blog[]> {
    const entities = await this.blogRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((entity) => BlogMapper.toDomain(entity));
  }

  async update(id: Blog['id'], payload: Partial<Blog>): Promise<Blog> {
    const entity = await this.blogRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Record not found');
    }

    const updatedEntity = await this.blogRepository.save(
      this.blogRepository.create(
        BlogMapper.toPersistence({
          ...BlogMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return BlogMapper.toDomain(updatedEntity);
  }

  async remove(id: Blog['id']): Promise<void> {
    await this.blogRepository.delete(id);
  }
}
