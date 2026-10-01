import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  FindOptionsWhere,
  Repository,
  In,
  ILike,
  IsNull,
  Between,
  MoreThanOrEqual,
} from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from '../../../../dto/query-user.dto';
import { User } from '../../../../domain/user';
import { UserRepository } from '../../user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { COMPLETED_ORDER_STATUSES } from '../../../../../overview/dto/overview.dto';
import { MembershipTierEnum } from '../../../../../wallets/tier/tier.enum';
import {
  WalletHoldStatusEnum,
  WalletStatusEnum,
} from '../../../../../wallets/wallets.enum';
import { tierBands } from '../../../../../wallets/tier/tier-bands';

/** Digits only — `KH-000123`, `kh 000123` and `123` all mean user 123 (#037). */
function customerCodeToId(code: string): number | null {
  const digits = code.replace(/\D/g, '');
  if (!digits) return null;
  const id = Number(digits);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * The effective membership tier is `tierOverride ?? automaticTier(spend)` and is
 * computed in {@link resolveTierSummary}, not stored — so filtering on it means
 * asking for two separate things and OR-ing them (#037):
 *
 *   - an admin pinned this tier: `tierOverride = <tier>`
 *   - nobody pinned anything and the spend earns it: `tierOverride IS NULL` and
 *     `lifetimeSpendVnd` inside that tier's band
 *
 * The bands come from the live tier registry, so a threshold an admin changes in
 * `membership_tier_config` moves this filter with it. Returned as one partial
 * where-clause per case, to be OR-ed by the caller.
 */
function tierWherePredicates(
  tiers: MembershipTierEnum[],
): FindOptionsWhere<UserEntity>[] {
  const bands = tierBands(tiers);
  if (!bands.length) return [{}];

  return [
    { tierOverride: In(bands.map((band) => band.tier)) },
    ...bands.map((band) => ({
      tierOverride: IsNull(),
      lifetimeSpendVnd:
        band.ceilingVnd === null
          ? MoreThanOrEqual(band.floorVnd)
          : Between(band.floorVnd, band.ceilingVnd),
    })),
  ];
}

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
    const baseWhere: FindOptionsWhere<UserEntity> = {};
    if (filterOptions?.roles?.length) {
      baseWhere.role = {
        id: In(filterOptions.roles.map((role) => Number(role.id))),
      };
    }
    if (filterOptions?.statusIds?.length) {
      baseWhere.status = { id: In(filterOptions.statusIds) };
    }
    if (filterOptions?.customerCode) {
      const id = customerCodeToId(filterOptions.customerCode);
      // A code that carries no digits can match nothing — `id = 0` says so,
      // rather than silently returning the whole customer list.
      baseWhere.id = id ?? 0;
    }

    // Search across email, firstName, lastName, phoneNumber with OR
    const searchPredicates: FindOptionsWhere<UserEntity>[] =
      filterOptions?.search
        ? [
            { email: ILike(`%${filterOptions.search}%`) },
            { firstName: ILike(`%${filterOptions.search}%`) },
            { lastName: ILike(`%${filterOptions.search}%`) },
            { phoneNumber: ILike(`%${filterOptions.search}%`) },
          ]
        : [{}];

    const tierPredicates = filterOptions?.membershipTiers?.length
      ? tierWherePredicates(filterOptions.membershipTiers)
      : [{}];

    // Find-options express OR as an array of whole where-objects, so two
    // independent OR groups have to be crossed. Both groups are small (≤4 and
    // ≤5), and everything in `baseWhere` is a plain AND repeated in each branch.
    const where: FindOptionsWhere<UserEntity>[] = searchPredicates.flatMap(
      (search) =>
        tierPredicates.map((tier) => ({ ...baseWhere, ...search, ...tier })),
    );

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
   * Fill in the figures the admin customer list needs but the user table does
   * not hold: the customer's own referral code, how many orders they have paid
   * for (#056), and their eXu balance and expiry (#038).
   *
   * Set-based queries for the whole page, never one per row — the list is
   * paginated but a per-row lookup would still be 10-50 round trips per render.
   * That is also why the eXu figures are computed here in SQL instead of calling
   * `WalletsService.getAvailableBalance`, which opens a transaction per user.
   */
  private async attachCustomerSummary(users: User[]): Promise<void> {
    const ids = users.map((user) => Number(user.id)).filter((id) => id > 0);
    if (ids.length === 0) return;

    const manager = this.usersRepository.manager;

    const [referralRows, orderRows, walletRows] = await Promise.all([
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
      // `available` mirrors `WalletsService.getAvailableBalanceWithManager`
      // exactly: nothing is spendable while the wallet is not active or past its
      // expiry, and money under an unexpired hold is already committed to an
      // order. The gross balance travels too, so the list can explain a 0.
      manager.query<
        {
          userId: number;
          balance: string;
          held: string;
          available: string;
          status: string;
          expiresAt: Date | null;
        }[]
      >(
        `SELECT w."userId",
                w."balanceVnd"::text AS "balance",
                COALESCE(h."held", 0)::text AS "held",
                CASE
                  WHEN w."status" <> $2 THEN 0
                  WHEN w."expiresAt" IS NOT NULL AND w."expiresAt" < NOW() THEN 0
                  ELSE GREATEST(0, w."balanceVnd" - COALESCE(h."held", 0))
                END::text AS "available",
                w."status",
                w."expiresAt"
         FROM "user_wallet" w
         LEFT JOIN (
           SELECT "userId", SUM("amountVnd") AS "held"
           FROM "wallet_hold"
           WHERE "userId" = ANY($1) AND "status" = $3 AND "expiresAt" > NOW()
           GROUP BY "userId"
         ) h ON h."userId" = w."userId"
         WHERE w."userId" = ANY($1)`,
        [ids, WalletStatusEnum.ACTIVE, WalletHoldStatusEnum.HELD],
      ),
    ]);

    const codeByUser = new Map(
      referralRows.map((row) => [Number(row.userId), row.code]),
    );
    const countByUser = new Map(
      orderRows.map((row) => [Number(row.userId), Number(row.count)]),
    );
    const walletByUser = new Map(
      walletRows.map((row) => [Number(row.userId), row]),
    );

    for (const user of users) {
      const id = Number(user.id);
      user.referralCode = codeByUser.get(id) ?? null;
      user.paidOrderCount = countByUser.get(id) ?? 0;

      // A customer with no wallet row has simply never earned eXu — 0, not null,
      // so the column reads as a balance rather than as missing data.
      const wallet = walletByUser.get(id);
      user.exuBalanceVnd = wallet ? Number(wallet.available) : 0;
      user.exuGrossBalanceVnd = wallet ? Number(wallet.balance) : 0;
      user.exuHeldVnd = wallet ? Number(wallet.held) : 0;
      user.exuExpiresAt = wallet?.expiresAt ? new Date(wallet.expiresAt) : null;
      user.exuWalletStatus = wallet?.status ?? null;
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
