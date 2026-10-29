import { RoleEnum } from './roles.enum';
import { FaqsController } from '../faqs/faqs.controller';
import { MiniTagsController } from '../mini-tags/mini-tags.controller';

/**
 * vande #086: an author manages Mini Tags and FAQs too, beside blog posts —
 * every write of the two that an admin may do, an author may do.
 */
function rolesOf(controller: { prototype: object }, method: string) {
  const handler = (controller.prototype as Record<string, unknown>)[method];
  return Reflect.getMetadata('roles', handler as object) as
    | RoleEnum[]
    | undefined;
}

describe('Author access to Mini Tags and FAQs (vande #086)', () => {
  it.each([
    [MiniTagsController, ['create', 'update', 'remove']],
    [FaqsController, ['create', 'update', 'remove']],
  ] as const)('%p writes are open to authors', (controller, methods) => {
    for (const method of methods) {
      const roles = rolesOf(controller, method);
      expect(roles).toEqual(
        expect.arrayContaining([RoleEnum.admin, RoleEnum.author]),
      );
    }
  });

  it('should still keep customers and partners out', () => {
    const roles = rolesOf(FaqsController, 'create') ?? [];
    expect(roles).not.toContain(RoleEnum.user);
    expect(roles).not.toContain(RoleEnum.partner);
  });
});
