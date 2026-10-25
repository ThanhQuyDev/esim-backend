import { createdAtInVnDays } from './created-range';

/** vande #041 — "Thời gian tạo Từ – đến" counts whole days in Vietnam time. */
describe('createdAtInVnDays', () => {
  it('should be undefined with no bounds', () => {
    expect(createdAtInVnDays(undefined, null)).toBeUndefined();
  });

  it('should take whole Vietnam days for both bounds', () => {
    const op = createdAtInVnDays('2026-10-20', '2026-10-22')!;
    const sql = (op as unknown as { getSql: (a: string) => string }).getSql(
      '"faq"."createdAt"',
    );
    expect(sql).toContain(`"faq"."createdAt" >= ((:createdFrom::date)`);
    expect(sql).toContain(
      `"faq"."createdAt" < ((:createdTo::date + INTERVAL '1 day')`,
    );
    expect(sql).toContain(`'Asia/Ho_Chi_Minh'`);
    expect(op.objectLiteralParameters).toEqual({
      createdFrom: '2026-10-20',
      createdTo: '2026-10-22',
    });
  });
});
