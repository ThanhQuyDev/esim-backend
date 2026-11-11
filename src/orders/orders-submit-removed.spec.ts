import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { RoleEnum } from '../roles/roles.enum';

const ROLES_KEY = 'roles';

/**
 * SECURITY 12/11/2026 — `POST /orders/submit` let any signed-in account place
 * real supplier orders without paying. It must never come back, and no other
 * route on this controller may let a customer create an order.
 */
describe('OrdersController: no unpaid order route for customers', () => {
  const proto = OrdersController.prototype as unknown as Record<
    string,
    unknown
  >;
  const routes = Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = proto[name] as object;
      return {
        name,
        path: Reflect.getMetadata(PATH_METADATA, handler) as string | undefined,
        method: Reflect.getMetadata(METHOD_METADATA, handler) as
          | RequestMethod
          | undefined,
        roles: (Reflect.getMetadata(ROLES_KEY, handler) ??
          Reflect.getMetadata(ROLES_KEY, OrdersController)) as
          | number[]
          | undefined,
      };
    })
    .filter((r) => r.path !== undefined);

  it('should have no submit route', () => {
    expect(routes.map((r) => r.path)).not.toContain('submit');
    expect(proto.submitOrder).toBeUndefined();
  });

  it('should let only an admin create an order here', () => {
    const create = routes.filter(
      (r) =>
        r.method === RequestMethod.POST && (r.path === '/' || r.path === ''),
    );
    for (const route of create) {
      expect(route.roles).toEqual([RoleEnum.admin]);
    }
  });
});
