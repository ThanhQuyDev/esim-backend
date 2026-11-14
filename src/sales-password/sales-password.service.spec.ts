import bcrypt from 'bcryptjs';
import { HttpException } from '@nestjs/common';
import { SalesPasswordGuard } from './sales-password.guard';
import {
  maskEmail,
  SALES_PASSWORD_MAX_TRIES,
  SalesPasswordService,
} from './sales-password.service';

/**
 * vande-1411 #004: someone who guessed a sign-in password placed orders. Money
 * transactions now also need the "mật khẩu bán hàng", checked on the server.
 */
describe('Mật khẩu bán hàng (vande-1411 #004)', () => {
  const LOGIN = 'dang-nhap-123';
  const SALES = 'ban-hang-456';

  async function build(user: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = {
      email: 'admin@example.com',
      password: await bcrypt.hash(LOGIN, 4),
      salesPasswordHash: await bcrypt.hash(SALES, 4),
      salesPasswordSetAt: new Date(),
      salesPasswordFailedCount: 0,
      salesPasswordLockedUntil: null,
      salesPasswordCodeHash: null,
      salesPasswordCodeExpiresAt: null,
      salesPasswordCodeAttempts: 0,
      ...user,
    };
    const queries: { sql: string; params: unknown[] }[] = [];
    const dataSource = {
      query: jest.fn((sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        if (sql.startsWith('SELECT')) return Promise.resolve([{ ...row }]);
        if (sql.includes('"salesPasswordFailedCount" + 1')) {
          row.salesPasswordFailedCount =
            Number(row.salesPasswordFailedCount) + 1;
          return Promise.resolve([[{ n: row.salesPasswordFailedCount }], 1]);
        }
        if (sql.includes('"salesPasswordCodeAttempts" + 1')) {
          row.salesPasswordCodeAttempts =
            Number(row.salesPasswordCodeAttempts) + 1;
          return Promise.resolve([[{ n: row.salesPasswordCodeAttempts }], 1]);
        }
        if (sql.includes('"salesPasswordCodeHash" = $2')) {
          row.salesPasswordCodeHash = params[1];
          row.salesPasswordCodeExpiresAt = new Date(Date.now() + 15 * 60_000);
        }
        if (sql.includes('"salesPasswordHash" = $2')) {
          row.salesPasswordHash = params[1];
        }
        return Promise.resolve([]);
      }),
    };
    const mailService = { sendSalesPasswordCode: jest.fn() };
    const service = new SalesPasswordService(
      dataSource as never,
      mailService as never,
    );
    return { service, row, queries, mailService };
  }
  const reason = async (p: Promise<unknown>) => {
    try {
      await p;
      return 'passed';
    } catch (e) {
      return (
        (e as HttpException).getResponse() as {
          errors?: { salesPassword?: string };
        }
      ).errors?.salesPassword;
    }
  };

  it('should let the transaction through with the right password', async () => {
    const { service } = await build();
    await expect(service.verify(1, SALES)).resolves.toBeUndefined();
  });

  it('should stop it without the password, or with a wrong one', async () => {
    const { service } = await build();
    expect(await reason(service.verify(1, null))).toBe('required');
    expect(await reason(service.verify(1, 'sai'))).toBe('invalid');
  });

  it('should stop it when the account has no sales password yet', async () => {
    const { service } = await build({ salesPasswordHash: null });
    expect(await reason(service.verify(1, SALES))).toBe('not_set');
  });

  it('should lock after 5 wrong tries, even with the right one then', async () => {
    const { service } = await build();
    for (let i = 1; i < SALES_PASSWORD_MAX_TRIES; i++) {
      expect(await reason(service.verify(1, 'sai'))).toBe('invalid');
    }
    expect(await reason(service.verify(1, 'sai'))).toBe('locked');
    const locked = await build({
      salesPasswordLockedUntil: new Date(Date.now() + 60_000),
    });
    expect(await reason(locked.service.verify(1, SALES))).toBe('locked');
  });

  it('should never write the password or the code in clear', async () => {
    const { service, queries, mailService } = await build({
      salesPasswordHash: null,
    });
    await service.requestCode(1);
    const code = mailService.sendSalesPasswordCode.mock.calls[0][0].code;
    expect(code).toMatch(/^\d{6}$/);
    await service.setWithCode(1, code, 'mat-khau-moi');
    const params = JSON.stringify(queries.map((q) => q.params));
    expect(params).not.toContain('mat-khau-moi');
    expect(params).not.toContain(`"${code}"`);
  });

  it('should set it only with the mailed code', async () => {
    const { service, mailService } = await build({ salesPasswordHash: null });
    await service.requestCode(1);
    const code = mailService.sendSalesPasswordCode.mock.calls[0][0].code;
    const wrong = code === '000000' ? '111111' : '000000';
    await expect(service.setWithCode(1, wrong, 'mat-khau-moi')).rejects.toThrow(
      'Mã xác nhận không đúng',
    );
    await expect(service.setWithCode(1, code, 'mat-khau-moi')).resolves.toEqual(
      { ok: true },
    );
  });

  it('should refuse the sign-in password, or a short one', async () => {
    const { service } = await build();
    await expect(service.change(1, SALES, LOGIN)).rejects.toThrow(
      'không được trùng mật khẩu đăng nhập',
    );
    await expect(service.change(1, SALES, '123')).rejects.toThrow('từ 6');
  });

  it('should need the current one to change it', async () => {
    const { service } = await build();
    expect(await reason(service.change(1, 'sai', 'mat-khau-moi'))).toBe(
      'invalid',
    );
  });

  it('should say where the code went without spelling the email out', () => {
    expect(maskEmail('thanh.tho@example.com')).toBe('t***@example.com');
  });

  it('should read the password from the X-Sales-Password header', async () => {
    const verify = jest.fn().mockResolvedValue(undefined);
    const guard = new SalesPasswordGuard({ verify } as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 7 },
          headers: { 'x-sales-password': SALES },
        }),
      }),
    };
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith(7, SALES);
  });
});
