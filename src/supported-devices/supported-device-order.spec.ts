import { SupportedDevicesService } from './supported-devices.service';
import { DeviceType, SupportedDevice } from './domain/supported-device';
import {
  compareBrands,
  compareDisplayOrder,
  positionRank,
} from './supported-device-order';

/**
 * #047 — "nhập số để sắp xếp thứ tự thì báo lỗi không lưu được", and 300+
 * devices in one list were too hard to order.
 */
function device(overrides: Partial<SupportedDevice>): SupportedDevice {
  return {
    id: 'd',
    device: 'Model',
    manufacturer: 'Brand',
    type: DeviceType.SMART_PHONES,
    manufacturerOrder: 0,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('supported device display order', () => {
  it('should put numbered brands before the unnumbered ones', () => {
    const brands = [
      { manufacturer: 'Asus', manufacturerOrder: 0 },
      { manufacturer: 'iPhone', manufacturerOrder: 1 },
      { manufacturer: 'Samsung', manufacturerOrder: 2 },
      { manufacturer: 'Google', manufacturerOrder: 0 },
    ];

    expect(brands.sort(compareBrands).map((b) => b.manufacturer)).toEqual([
      'iPhone',
      'Samsung',
      'Asus',
      'Google',
    ]);
  });

  it('should treat 0 and a missing position as unset', () => {
    expect(positionRank(0)).toBe(Number.POSITIVE_INFINITY);
    expect(positionRank(undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(positionRank(3)).toBe(3);
  });

  it('should order by type, then brand, then model', () => {
    const devices = [
      device({ id: 'tab', type: DeviceType.TABLETS, manufacturer: 'iPhone' }),
      device({
        id: 'old',
        manufacturer: 'iPhone',
        manufacturerOrder: 1,
        device: 'iPhone 11',
      }),
      device({
        id: 'new',
        manufacturer: 'iPhone',
        manufacturerOrder: 1,
        device: 'iPhone 17',
        sortOrder: 1,
      }),
      device({ id: 'sam', manufacturer: 'Samsung', manufacturerOrder: 2 }),
      device({ id: 'asus', manufacturer: 'Asus' }),
    ];

    expect(devices.sort(compareDisplayOrder).map((d) => d.id)).toEqual([
      'new',
      'old',
      'sam',
      'asus',
      'tab',
    ]);
  });

  it('should sort names naturally, so iPhone 9 comes before iPhone 10', () => {
    const devices = [
      device({ id: '10', device: 'iPhone 10' }),
      device({ id: '9', device: 'iPhone 9' }),
    ];

    expect(devices.sort(compareDisplayOrder).map((d) => d.id)).toEqual([
      '9',
      '10',
    ]);
  });
});

describe('SupportedDevicesService — ordering by brand (#047)', () => {
  function setup(devices: SupportedDevice[] = []) {
    const repository = {
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      findGrouped: jest.fn().mockResolvedValue(devices),
      findManufacturerOrder: jest.fn().mockResolvedValue(undefined),
      setManufacturerOrder: jest.fn().mockResolvedValue(undefined),
      setSortOrders: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SupportedDevicesService(repository as never);
    return { service, repository };
  }

  it('should give a new model its brand position when none is entered', async () => {
    const { service, repository } = setup();
    repository.findManufacturerOrder.mockResolvedValue(3);

    await service.create({
      device: 'Galaxy S26',
      manufacturer: 'Samsung',
      type: DeviceType.SMART_PHONES,
      sortOrder: 1,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ manufacturerOrder: 3, sortOrder: 1 }),
    );
    // And the brand's other models are left where they are.
    expect(repository.setManufacturerOrder).not.toHaveBeenCalled();
  });

  it('should list brands in order, each with its models in order', async () => {
    const { service } = setup([
      device({ id: 'a1', manufacturer: 'Asus', device: 'Zenfone' }),
      device({
        id: 'i2',
        manufacturer: 'iPhone',
        manufacturerOrder: 1,
        device: 'iPhone 11',
      }),
      device({
        id: 'i1',
        manufacturer: 'iPhone',
        manufacturerOrder: 1,
        device: 'iPhone 17',
        sortOrder: 1,
      }),
      device({
        id: 'it',
        manufacturer: 'iPhone',
        manufacturerOrder: 1,
        device: 'iPad',
        type: DeviceType.TABLETS,
      }),
    ]);

    const ordering = await service.findOrdering();

    expect(ordering.map((b) => b.manufacturer)).toEqual(['iPhone', 'Asus']);
    expect(ordering[0].manufacturerOrder).toBe(1);
    expect(ordering[0].devices.map((d) => d.id)).toEqual(['i1', 'i2', 'it']);
  });

  it('should save brand positions and model positions in one request', async () => {
    const { service, repository } = setup();

    await service.saveOrdering({
      manufacturers: [
        { manufacturer: 'iPhone', manufacturerOrder: 1 },
        { manufacturer: 'Samsung', manufacturerOrder: 2 },
      ],
      devices: [{ id: 'd-1', sortOrder: 4 }],
    });

    expect(repository.setManufacturerOrder).toHaveBeenCalledWith('iPhone', 1);
    expect(repository.setManufacturerOrder).toHaveBeenCalledWith('Samsung', 2);
    expect(repository.setSortOrders).toHaveBeenCalledWith([
      { id: 'd-1', sortOrder: 4 },
    ]);
  });
});
