import { instanceToPlain } from 'class-transformer';
import { User } from '../users/domain/user';

/**
 * #024 — "email: chưa lấy được thông tin email của đơn hàng".
 *
 * `User.email` is `@Expose({ groups: ['me', 'admin'] })`, so the global
 * ClassSerializerInterceptor removes it from any response whose handler does not
 * declare a group. The eSIM detail endpoint declared none, which is why the CMS
 * showed an empty Email row while the rest of the user block rendered.
 */
describe('Buyer email in the eSIM detail response (#024)', () => {
  function makeUser(): User {
    const user = new User();
    user.id = 7;
    user.email = 'buyer@esim.vn';
    user.firstName = 'Nguyen';
    user.lastName = 'Van A';
    return user;
  }

  it('should is stripped when the handler declares no serialization group', () => {
    const plain = instanceToPlain(makeUser(), { strategy: 'exposeAll' });
    // `exposeAll` still honours a group-restricted @Expose.
    expect(plain.email).toBeUndefined();
  });

  it('should is present under the admin group, which the endpoint now declares', () => {
    const plain = instanceToPlain(makeUser(), { groups: ['admin'] });
    expect(plain.email).toBe('buyer@esim.vn');
  });

  it('should is present for the account itself under the me group', () => {
    const plain = instanceToPlain(makeUser(), { groups: ['me'] });
    expect(plain.email).toBe('buyer@esim.vn');
  });

  it('should never exposes the password, whatever the group', () => {
    const user = makeUser();
    user.password = 'hashed';

    for (const groups of [['admin'], ['me'], []]) {
      expect(instanceToPlain(user, { groups }).password).toBeUndefined();
    }
  });
});
