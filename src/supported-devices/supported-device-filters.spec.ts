import { In } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { SupportedDeviceRelationalRepository } from './infrastructure/persistence/relational/repositories/supported-device.repository';
import { FindAllSupportedDevicesDto } from './dto/find-all-supported-devices.dto';
import { DeviceType } from './domain/supported-device';

/**
 * #052 — the Loại thiết bị filter did not work, and there was no way to filter by
 * brand.
 *
 * Two separate causes. In the CMS, the column had no explicit `id`, so the filter
 * param was registered under the empty string and never reached the query. Here in
 * the API, `type` was a single value compared with `=`, so the multi-select's
 * "Tablets,Laptops" matched nothing even once the param arrived.
 */
describe('Supported device filters (#052)', () => {
  describe('query parsing', () => {
    function parse(query: Record<string, unknown>) {
      return plainToInstance(FindAllSupportedDevicesDto, query);
    }

    it('should accept a comma-separated list of types', () => {
      expect(parse({ type: 'Tablets,Laptops' }).type).toEqual([
        'Tablets',
        'Laptops',
      ]);
    });

    it('should still accept a single type', () => {
      expect(parse({ type: 'Smart Phones' }).type).toEqual(['Smart Phones']);
    });

    it('should trim the entries, because the CMS joins on a bare comma', () => {
      expect(parse({ type: ' Tablets , Laptops ' }).type).toEqual([
        'Tablets',
        'Laptops',
      ]);
    });

    it('should be undefined when nothing was picked', () => {
      // Not `['']`, which would be validated as an invalid enum value and 400.
      expect(parse({ type: '' }).type).toBeUndefined();
      expect(parse({}).type).toBeUndefined();
    });

    it('should carry the manufacturer through', () => {
      expect(parse({ manufacturer: 'Apple' }).manufacturer).toBe('Apple');
    });
  });

  describe('the where clause', () => {
    function makeRepo() {
      const find = jest.fn().mockResolvedValue([]);
      const repo = new SupportedDeviceRelationalRepository({ find } as never);
      return { repo, find };
    }

    async function whereFor(args: Record<string, unknown>) {
      const { repo, find } = makeRepo();
      await repo.findAllWithPagination({
        paginationOptions: { page: 1, limit: 10 },
        ...args,
      } as never);
      return find.mock.calls[0][0].where as Record<string, unknown>;
    }

    it('should compare a single type directly', async () => {
      const where = await whereFor({ type: [DeviceType.SMART_PHONES] });

      expect(where.type).toBe(DeviceType.SMART_PHONES);
    });

    it('should use IN for several types, so picking two widens the result', async () => {
      const where = await whereFor({
        type: [DeviceType.TABLETS, DeviceType.LAPTOPS],
      });

      expect(where.type).toEqual(In([DeviceType.TABLETS, DeviceType.LAPTOPS]));
    });

    it('should add no type clause for an empty list', async () => {
      const where = await whereFor({ type: [] });

      expect(where.type).toBeUndefined();
    });

    it('should filter on an exact manufacturer', async () => {
      const where = await whereFor({ manufacturer: 'Apple' });

      expect(where.manufacturer).toBe('Apple');
    });

    it('should combine type, manufacturer and search', async () => {
      const where = await whereFor({
        type: [DeviceType.TABLETS],
        manufacturer: 'Apple',
        search: 'ipad',
      });

      expect(where.type).toBe(DeviceType.TABLETS);
      expect(where.manufacturer).toBe('Apple');
      expect(where.device).toBeDefined();
    });
  });
});
