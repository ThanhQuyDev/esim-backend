import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { currentTierBenefits } from '../wallets/tier/tier.registry';
import { CreateUserDto } from './dto/create-user.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from './dto/query-user.dto';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { User } from './domain/user';
import bcrypt from 'bcryptjs';
import { AuthProvidersEnum } from '../auth/auth-providers.enum';
import { FilesService } from '../files/files.service';
import { RoleEnum } from '../roles/roles.enum';
import { cleanExtraRoleIds } from '../roles/extra-roles';
import { StatusEnum } from '../statuses/statuses.enum';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { FileType } from '../files/domain/file';
import { Role } from '../roles/domain/role';
import { Status } from '../statuses/domain/status';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthorsService } from '../authors/authors.service';
import { SessionService } from '../session/session.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly filesService: FilesService,
    private readonly authorsService: AuthorsService,
    private readonly sessionService?: SessionService,
  ) {}

  /**
   * "Khoá tài khoản" (security 15/11/2026). The account cannot sign in again,
   * and every device is signed out: its sessions go, and the JWT strategy
   * refuses any token of a locked account however long it still has to live.
   * An admin cannot lock themselves or another admin.
   */
  async lock(id: User['id'], reason: string, actorId?: User['id']) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { id: 'userNotFound' },
      });
    }
    if (
      String(user.id) === String(actorId) ||
      Number(user.role?.id) === RoleEnum.admin
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Không thể khoá tài khoản quản trị.',
        errors: { id: 'cannotLockAdmin' },
      });
    }
    const locked = await this.usersRepository.update(id, {
      lockedAt: user.lockedAt ?? new Date(),
      lockReason: reason.trim(),
    });
    await this.sessionService?.deleteByUserId({ userId: id });
    return locked;
  }

  unlock(id: User['id']) {
    return this.usersRepository.update(id, {
      lockedAt: null,
      lockReason: null,
    });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Do not remove comment below.
    // <creating-property />

    let password: string | undefined = undefined;

    if (createUserDto.password) {
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    let email: string | null = null;

    if (createUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        createUserDto.email,
      );
      if (userObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }
      email = createUserDto.email;
    }

    let photo: FileType | null | undefined = undefined;

    if (createUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        createUserDto.photo.id,
      );
      if (!fileObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            photo: 'imageNotExists',
          },
        });
      }
      photo = fileObject;
    } else if (createUserDto.photo === null) {
      photo = null;
    }

    let role: Role | undefined = undefined;

    if (createUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(createUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: createUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (createUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(createUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: createUserDto.status.id,
      };
    }

    // An author — by main role or one ticked on top (vande #071) — needs the
    // profile their articles are signed with.
    const extraRoleIds = cleanExtraRoleIds(
      createUserDto.extraRoleIds,
      role?.id,
    );
    const writes =
      Number(role?.id) === RoleEnum.author ||
      extraRoleIds.includes(RoleEnum.author);
    if (writes && !createUserDto.authorProfile) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { authorProfile: 'authorProfileRequired' },
      });
    }

    const user = await this.usersRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      phoneNumber: createUserDto.phoneNumber ?? null,
      lifetimeSpendVnd: 0,
      tierOverride: null,
      tierOverrideReason: null,
      email: email,
      password: password,
      photo: photo,
      role: role,
      extraRoleIds,
      status: status,
      provider: createUserDto.provider ?? AuthProvidersEnum.email,
      socialId: createUserDto.socialId,
    });

    if (createUserDto.authorProfile) {
      user.authorProfile = await this.authorsService.upsertForUser(
        Number(user.id),
        createUserDto.authorProfile,
      );
    }

    return user;
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[User[], number]> {
    return this.usersRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: User['id']): Promise<NullableType<User>> {
    return this.usersRepository.findById(id);
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByEmail(email: User['email']): Promise<NullableType<User>> {
    return this.usersRepository.findByEmail(email);
  }

  findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    return this.usersRepository.findBySocialIdAndProvider({
      socialId,
      provider,
    });
  }

  /**
   * Stamp a sign-in (#060, doitac-3010 #035). Its own method: `update` builds
   * the payload from the admin's form fields and dropped this one, so the
   * partner list read "Chưa đăng nhập" for partners who had signed in.
   */
  markSignedIn(id: User['id'], at: Date = new Date()): Promise<User | null> {
    return this.usersRepository.update(id, { lastLoginAt: at });
  }

  async update(
    id: User['id'],
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    // Do not remove comment below.
    // <updating-property />

    let password: string | undefined = undefined;

    if (updateUserDto.password) {
      const userObject = await this.usersRepository.findById(id);

      if (userObject && userObject?.password !== updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        password = await bcrypt.hash(updateUserDto.password, salt);
      }
    }

    let email: string | null | undefined = undefined;

    if (updateUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );

      // The route param arrives as a string ("5") while the stored id is a
      // number (5); comparing them strictly flagged every admin edit that kept
      // the user's own email as "emailAlreadyExists" (#025).
      if (userObject && String(userObject.id) !== String(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }

      email = updateUserDto.email;
    } else if (updateUserDto.email === null) {
      email = null;
    }

    let photo: FileType | null | undefined = undefined;

    if (updateUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        updateUserDto.photo.id,
      );
      if (!fileObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            photo: 'imageNotExists',
          },
        });
      }
      photo = fileObject;
    } else if (updateUserDto.photo === null) {
      photo = null;
    }

    let role: Role | undefined = undefined;

    if (updateUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(updateUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: updateUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (updateUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(updateUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: updateUserDto.status.id,
      };
    }

    const currentUser = await this.usersRepository.findById(id);
    const resultingRoleId = Number(role?.id ?? currentUser?.role?.id);
    // The extra roles as they will be: the ones sent, or the saved ones, minus
    // whatever has just become the main role (vande #071).
    const extraRoleIds = cleanExtraRoleIds(
      updateUserDto.extraRoleIds ?? currentUser?.extraRoleIds,
      resultingRoleId,
    );
    if (
      (resultingRoleId === RoleEnum.author ||
        extraRoleIds.includes(RoleEnum.author)) &&
      !updateUserDto.authorProfile &&
      !currentUser?.authorProfile
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { authorProfile: 'authorProfileRequired' },
      });
    }

    // Tiers are the admin's to add and remove (vande #066): one placed by
    // hand must still exist.
    if (
      updateUserDto.tierOverride &&
      !currentTierBenefits()[updateUserDto.tierOverride]
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { tierOverride: 'tierNotFound' },
      });
    }

    const user = await this.usersRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      ...(updateUserDto.phoneNumber !== undefined && {
        phoneNumber: updateUserDto.phoneNumber,
      }),
      ...(updateUserDto.tierOverride !== undefined && {
        tierOverride: updateUserDto.tierOverride,
      }),
      ...(updateUserDto.tierOverrideReason !== undefined && {
        tierOverrideReason: updateUserDto.tierOverrideReason,
      }),
      // Dropped here before, so a new password never cleared the "change your
      // password" flag (doitac-1410 #011).
      ...(updateUserDto.mustChangePassword !== undefined && {
        mustChangePassword: updateUserDto.mustChangePassword,
      }),
      email,
      password,
      photo,
      role,
      extraRoleIds,
      status,
      provider: updateUserDto.provider,
      socialId: updateUserDto.socialId,
    });

    if (user && updateUserDto.authorProfile) {
      user.authorProfile = await this.authorsService.upsertForUser(
        Number(user.id),
        updateUserDto.authorProfile,
      );
    }

    return user;
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.remove(id);
  }
}
