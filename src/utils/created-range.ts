import { FindOperator, Raw } from 'typeorm';

/**
 * "Thời gian tạo Từ – Đến" for a CMS list (vande #041): whole days in Vietnam
 * time, as the order list counts them (#017). `createdAt` is stored in UTC, so
 * the bounds are midnight in Ho Chi Minh City converted to UTC, and "to" takes
 * in the whole of its day. Undefined when neither bound is given.
 */
export function createdAtInVnDays(
  from?: string | null,
  to?: string | null,
): FindOperator<Date> | undefined {
  const parts: string[] = [];
  const params: Record<string, string> = {};
  if (from) {
    parts.push(
      `{alias} >= ((:createdFrom::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC')`,
    );
    params.createdFrom = from;
  }
  if (to) {
    parts.push(
      `{alias} < ((:createdTo::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC')`,
    );
    params.createdTo = to;
  }
  if (!parts.length) return undefined;
  return Raw(
    (alias) => parts.map((p) => p.split('{alias}').join(alias)).join(' AND '),
    params,
  );
}
