import { SupportedDevicesService } from './supported-devices.service';
import { DeviceType } from './domain/supported-device';

/**
 * Admin-controlled order for the supported-devices list (#090).
 *
 * The list was alphabetical and nothing else, so the newest iPhone sat below
 * the oldest one and no brand could be promoted. Two numbers now decide the
 * order — but the brand's number lives on every one of its devices, so setting
 * it on one row has to move the whole brand, or the brand splits across the
 * page.
 */
describe('SupportedDevicesService — display order', () => {
  function setup() {
    const create = jest
      .fn()
      .mockImplementation((data) => Promise.resolve(data));
    // Mimic the real repository: it loads the row, applies only the fields
    // actually supplied, and hands back the complete record.
    const update = jest.fn().mockImplementation((id, payload) => {
      const defined = Object.fromEntries(
        Object.entries(payload as Record<string, unknown>).filter(
          ([, value]) => value !== undefined,
        ),
      );
      return Promise.resolve({
        id,
        device: 'iPhone 16',
        manufacturer: 'Apple',
        type: DeviceType.SMART_PHONES,
        ...defined,
      });
    });
    const setManufacturerOrder = jest.fn().mockResolvedValue(undefined);

    const repository = { create, update, setManufacturerOrder };
    const service = new SupportedDevicesService(repository as never);

    return { service, create, update, setManufacturerOrder };
  }

  it('should store both order numbers on a new device', async () => {
    const { service, create } = setup();

    await service.create({
      device: 'iPhone 17 Pro Max',
      manufacturer: 'Apple',
      type: DeviceType.SMART_PHONES,
      manufacturerOrder: 1,
      sortOrder: 5,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ manufacturerOrder: 1, sortOrder: 5 }),
    );
  });

  it('should default both to zero, which means alphabetical', async () => {
    const { service, create } = setup();

    await service.create({
      device: 'Galaxy S25',
      manufacturer: 'Samsung',
      type: DeviceType.SMART_PHONES,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ manufacturerOrder: 0, sortOrder: 0 }),
    );
  });

  it('should move the whole brand when the brand position is set', async () => {
    const { service, setManufacturerOrder } = setup();

    await service.create({
      device: 'iPhone 17',
      manufacturer: 'Apple',
      type: DeviceType.SMART_PHONES,
      manufacturerOrder: 1,
    });

    // Every Apple row gets position 1, not just the one being edited.
    expect(setManufacturerOrder).toHaveBeenCalledWith('Apple', 1);
  });

  it('should move the brand when an existing device is re-ordered', async () => {
    const { service, setManufacturerOrder } = setup();

    await service.update('device-1', { manufacturerOrder: 2 });

    expect(setManufacturerOrder).toHaveBeenCalledWith('Apple', 2);
  });

  it('should leave the brand alone when only the model position changes', async () => {
    const { service, setManufacturerOrder, update } = setup();

    await service.update('device-1', { sortOrder: 3 });

    expect(update).toHaveBeenCalledWith(
      'device-1',
      expect.objectContaining({ sortOrder: 3 }),
    );
    expect(setManufacturerOrder).not.toHaveBeenCalled();
  });

  it('should apply the brand position to the brand being moved to', async () => {
    const { service, setManufacturerOrder } = setup();

    // The device is reassigned to Samsung and positioned in the same edit.
    await service.update('device-1', {
      manufacturer: 'Samsung',
      manufacturerOrder: 4,
    });

    expect(setManufacturerOrder).toHaveBeenCalledWith('Samsung', 4);
  });
});
