import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { FindOptionsWhere, Repository, In, ILike } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from '../../../../dto/query-user.dto';
import { User } from '../../../../domain/user';
import { UserRepository } from '../../user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { COMPLETED_ORDER_STATUSES } from '../../../../../overview/dto/overview.dto';

@Injectable()
export class UsersRelationalRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(data: User): Promise<User> {
    const persistenceModel = UserMapper.toPersistence(data);
    const newEntity = await this.usersRepository.save(
      this.usersRepository.create(persistenceModel),
    );
    return UserMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[User[], number]> {
    const where: FindOptionsWhere<UserEntity>[] = [];

    const baseWhere: FindOptionsWhere<UserEntity> = {};
    if (filterOptions?.roles?.length) {
      baseWhere.role = {
        id: In(filterOptions.roles.map((role) => Number(role.id))),
      };
    }

    if (filterOptions?.search) {
      // Search across email, firstName, lastName, phoneNumber with OR
      where.push(
        { ...baseWhere, email: ILike(`%${filterOptions.search}%`) },
        { ...baseWhere, firstName: ILike(`%${filterOptions.search}%`) },
        { ...baseWhere, lastName: ILike(`%${filterOptions.search}%`) },
        { ...baseWhere, phoneNumber: ILike(`%${filterOptions.search}%`) },
      );
    } else {
      where.push(baseWhere);
    }

    const [entities, count] = await this.usersRepository.findAndCount({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      order: sortOptions?.length
        ? sortOptions.reduce(
            (accumulator, sort) => ({
              ...accumulator,
              [sort.orderBy]: sort.order,
            }),
            {},
          )
        : { createdAt: 'DESC' },
    });

    const users = entities.map((user) => UserMapper.toDomain(user));
    await this.attachCustomerSummary(users);

    return [users, count];
  }

  /**
   * Fill in the two figures the admin customer list needs but the user table
   * does not hold: the customer's own referral code and how many orders they
   * have paid for (#056).
   *
   * Two set-based queries for the whole page, never one per row — the list is
   * paginated but a per-row lookup would still be 10-50 round trips per render.
   */
  private async attachCustomerSummary(users: User[]): Promise<void> {
    const ids = users.map((user) => Number(user.id)).filter((id) => id > 0);
    if (ids.length === 0) return;

    const manager = this.usersRepository.manager;

    const [referralRows, orderRows] = await Promise.all([
      manager.query<{ userId: number; code: string }[]>(
        `SELECT "userId", "code" FROM "user_referral_profile"
         WHERE "userId" = ANY($1) AND "isActive" = true`,
        [ids],
      ),
      // Same status set as the revenue dashboards (`COMPLETED_ORDER_STATUSES`):
      // a refunded order is not a completed purchase and must not be counted.
      manager.query<{ userId: number; count: string }[]>(
        `SELECT "userId", COUNT(*)::text AS "count" FROM "order"
         WHERE "userId" = ANY($1) AND "status" = ANY($2) AND "deletedAt" IS NULL
         GROUP BY "userId"`,
        [ids, [...COMPLETED_ORDER_STATUSES]],
      ),
    ]);

    const codeByUser = new Map(
      referralRows.map((row) => [Number(row.userId), row.code]),
    );
    const countByUser = new Map(
      orderRows.map((row) => [Number(row.userId), Number(row.count)]),
    );

    for (const user of users) {
      const id = Number(user.id);
      user.referralCode = codeByUser.get(id) ?? null;
      user.paidOrderCount = countByUser.get(id) ?? 0;
    }
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: User['id'][]): Promise<User[]> {
    const entities = await this.usersRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async findByEmail(email: User['email']): Promise<NullableType<User>> {
    if (!email) return null;

    const entity = await this.usersRepository.findOne({
      where: { email },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    if (!socialId || !provider) return null;

    const entity = await this.usersRepository.findOne({
      where: { socialId, provider },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async update(id: User['id'], payload: Partial<User>): Promise<User> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
    });

    if (!entity) {
      throw new Error('User not found');
    }

    const updatedEntity = await this.usersRepository.save(
      this.usersRepository.create(
        UserMapper.toPersistence({
          ...UserMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return UserMapper.toDomain(updatedEntity);
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.softDelete(id);
  }
}
