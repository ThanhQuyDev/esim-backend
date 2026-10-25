import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<(number | string)[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const allowed = roles.map(String);

    if (allowed.includes(String(request.user?.role?.id))) return true;

    // The roles ticked on top of the main one (vande #071). Read from the
    // database rather than the token, so a role an admin grants or takes away
    // counts on the next request, not at the next sign-in. Only reached when
    // the main role is not enough, so the usual request costs nothing.
    const userId = Number(request.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) return false;
    const [row] = (await this.dataSource.query(
      `SELECT "extraRoleIds" FROM "user" WHERE id = $1 AND "deletedAt" IS NULL`,
      [userId],
    )) as { extraRoleIds: number[] | null }[];
    return (row?.extraRoleIds ?? []).some((id) => allowed.includes(String(id)));
  }
}
