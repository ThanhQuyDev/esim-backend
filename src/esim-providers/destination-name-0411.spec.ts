import { destinationNameFromCode } from './catalogue-naming';
import { MicroEsimService } from './microesim/microesim.service';

describe('Tên điểm đến từ mã NCC (vande-0411 #030)', () => {
  it.each([
    ['PR', 'Puerto Rico'],
    ['MP', 'Northern Mariana Islands'],
    ['PT-20', 'Azores'],
    ['PT-30', 'Madeira'],
    ['US-HI', 'Hawaii'],
    ['pr', 'Puerto Rico'],
  ])('should name %s', (code, name) => {
    expect(destinationNameFromCode(code)).toBe(name);
  });

  it('should keep a code nothing knows', () => {
    expect(destinationNameFromCode('XX-99')).toBe('XX-99');
  });

  function service(existing: Record<string, unknown>) {
    const destinationsService = {
      findByCountryCode: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const svc = Object.create(MicroEsimService.prototype) as never as {
      resolveDestinationByCode(code: string): Promise<{ name: string }>;
    };
    Object.assign(svc, { destinationsService });
    return { svc, destinationsService };
  }

  it('should rename a destination left under its bare code', async () => {
    const { svc, destinationsService } = service({ id: 218, name: 'PR' });

    const result = await svc.resolveDestinationByCode('PR');

    expect(destinationsService.update).toHaveBeenCalledWith(218, {
      name: 'Puerto Rico',
    });
    expect(result.name).toBe('Puerto Rico');
  });

  it('should leave a name set in the CMS alone', async () => {
    const { svc, destinationsService } = service({ id: 1, name: 'Nhật Bản' });

    await svc.resolveDestinationByCode('JP');

    expect(destinationsService.update).not.toHaveBeenCalled();
  });
});
