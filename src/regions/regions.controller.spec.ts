import { RegionsController } from './regions.controller';

describe('RegionsController pagination', () => {
  it('should allow 200 rows and cap larger values', async () => {
    const regionsService = {
      findManyWithPagination: jest.fn().mockResolvedValue([[], 0]),
    };
    const controller = new RegionsController(regionsService as never);

    await controller.findAll({ page: 1, limit: 200 } as never);
    await controller.findAll({ page: 1, limit: 500 } as never);

    expect(regionsService.findManyWithPagination).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ paginationOptions: { page: 1, limit: 200 } }),
    );
    expect(regionsService.findManyWithPagination).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ paginationOptions: { page: 1, limit: 200 } }),
    );
  });
});
