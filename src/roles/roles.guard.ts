import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

/** Said in Vietnamese, as every other message the CMS shows (doitac-3010 #007). */
export const ROLE_FORBIDDEN_MESSAGE =
  'Tài khoản của bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ quản trị viên để được phân quyền.';

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

    // The roles the account holds now, read from the database rather than the
    // token: the roles ticked on top of the main one (vande #071), and the main
    // role itself — an author made Admin while signed in still carried
    // "Author" in their token, and "Đặt đơn hộ" answered "Forbidden resource"
    // until they signed in again (doitac-3010 #007). Only reached when the
    // token's role is not enough, so the usual request costs nothing.
    const userId = Number(request.user?.id);
    if (Number.isInteger(userId) && userId > 0) {
      const [row] = (await this.dataSource.query(
        `SELECT "roleId", "extraRoleIds" FROM "user"
          WHERE id = $1 AND "deletedAt" IS NULL`,
        [userId],
      )) as { roleId: number | null; extraRoleIds: number[] | null }[];
      const held = [row?.roleId, ...(row?.extraRoleIds ?? [])]
        .filter((id) => id != null)
        .map(String);
      if (held.some((id) => allowed.includes(id))) return true;
    }
    throw new ForbiddenException(ROLE_FORBIDDEN_MESSAGE);
  }
}
