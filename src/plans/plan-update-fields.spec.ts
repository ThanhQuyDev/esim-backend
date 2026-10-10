import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * #043 (test round 4) — `PlansService.update` copies fields one by one, and
 * `isNonHkIp`, `activationValidityDays` and the "Giờ làm mới" fields were never
 * on the list. Every supplier re-sync goes through `update`, so the TikTok /
 * ChatGPT flag of esimaccess "(nonhkip)" plans was silently dropped.
 *
 * This reads both files so a field added to CreatePlanDto but forgotten in
 * `update` fails here instead of in production.
 */
describe('PlansService.update forwards every plan field (#043)', () => {
  it('should forward each CreatePlanDto field to the repository', () => {
    const dto = readFileSync(
      join(__dirname, 'dto', 'create-plan.dto.ts'),
      'utf8',
    );
    const service = readFileSync(join(__dirname, 'plans.service.ts'), 'utf8');

    const fields = [...dto.matchAll(/^\s{2}(\w+)\??:\s/gm)].map((m) => m[1]);
    const start = service.indexOf('return this.plansRepository.update(id, {');
    const end = service.indexOf('/** Distinct APN values', start);
    const block = service.slice(start, end);

    const missing = fields.filter(
      (field) => !new RegExp(String.raw`\b${field}:`).test(block),
    );
    expect(fields.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });
});
