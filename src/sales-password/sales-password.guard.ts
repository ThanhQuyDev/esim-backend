import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  SALES_PASSWORD_HEADER,
  SalesPasswordService,
} from './sales-password.service';

/**
 * Put after the sign-in guards on every route that moves money
 * (vande-1411 #004): the request must carry the account's sales password in
 * the `X-Sales-Password` header. Checked on the server, so a script that
 * skips the screen is stopped too.
 */
@Injectable()
export class SalesPasswordGuard implements CanActivate {
  constructor(private readonly salesPassword: SalesPasswordService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: { id?: number | string };
      headers: Record<string, string | string[] | undefined>;
    }>();
    const userId = Number(req.user?.id);
    if (!userId) throw new UnauthorizedException();
    const raw = req.headers[SALES_PASSWORD_HEADER];
    const given = Array.isArray(raw) ? raw[0] : raw;
    await this.salesPassword.verify(userId, given ?? null);
    return true;
  }
}
