import { UnprocessableEntityException } from '@nestjs/common';
import { UsersService } from './users.service';
import { RoleEnum } from '../roles/roles.enum';

/**
 * Editing a user from the CMS (#025).
 *
 * The route hands the id over as a string, the repository answers with a number.
 * Comparing the two strictly made the user's own unchanged email look taken, so
 * every save — including turning someone into an author — failed.
 */

function makeService() {
  const stored = {
    id: 5,
    email: 'tacgia@esim.vn',
    role: { id: RoleEnum.user },
    authorProfile: null,
  };

  const usersRepository = {
    findByEmail: jest.fn((email: string) =>
      Promise.resolve(email === stored.email ? stored : null),
    ),
    findById: jest.fn(() => Promise.resolve(stored)),
    update: jest.fn((id: number, payload: object) =>
      Promise.resolve({ ...stored, ...payload, id }),
    ),
  };
  const authorsService = {
    upsertForUser: jest.fn((userId: number, profile: object) =>
      Promise.resolve({ id: 1, userId, ...profile }),
    ),
  };

  const service = new UsersService(
    usersRepository as never,
    {} as never,
    authorsService as never,
  );
  return { service, usersRepository, authorsService };
}

describe('UsersService.update (#025)', () => {
  it('should accept the user keeping their own email when the id is a string', async () => {
    const { service, usersRepository } = makeService();

    await expect(
      service.update('5', { email: 'tacgia@esim.vn', firstName: 'An' }),
    ).resolves.toMatchObject({ email: 'tacgia@esim.vn' });
    expect(usersRepository.update).toHaveBeenCalled();
  });

  it('should make the user an author and save the bilingual profile', async () => {
    const { service, authorsService } = makeService();

    const user = await service.update('5', {
      email: 'tacgia@esim.vn',
      role: { id: RoleEnum.author },
      authorProfile: {
        name: 'Nguyễn Văn A',
        nameEn: 'Nguyen Van A',
        slug: 'nguyen-van-a',
        description: 'Biên tập viên',
        descriptionEn: 'Editor',
      },
    });

    expect(authorsService.upsertForUser).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ nameEn: 'Nguyen Van A' }),
    );
    expect(user?.authorProfile).toMatchObject({ descriptionEn: 'Editor' });
  });

  it('should still refuse an email another user owns', async () => {
    const { service, usersRepository } = makeService();

    await expect(
      service.update('9', { email: 'tacgia@esim.vn' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(usersRepository.update).not.toHaveBeenCalled();
  });
});
