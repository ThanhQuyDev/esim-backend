import { ApnSupportController } from './apn-support.controller';

/**
 * vande #043 — picking "200 rows" in the CMS still showed 50: the API cut
 * every page at 50 while the CMS tables offer 100 and 200.
 */
describe('ApnSupportController page size (vande #043)', () => {
  const setup = () => {
    const service = {
      findAllWithPagination: jest.fn().mockResolvedValue([[], 0]),
    };
    return { service, controller: new ApnSupportController(service as never) };
  };

  it('should allow 200 rows a page', async () => {
    const { service, controller } = setup();

    await controller.findAll({ page: 1, limit: 200 } as never);

    expect(service.findAllWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({ paginationOptions: { page: 1, limit: 200 } }),
    );
  });

  it('should cap anything larger at 200', async () => {
    const { service, controller } = setup();

    await controller.findAll({ page: 1, limit: 1000 } as never);

    expect(service.findAllWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({ paginationOptions: { page: 1, limit: 200 } }),
    );
  });
});
