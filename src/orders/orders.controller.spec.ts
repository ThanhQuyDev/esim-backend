import { OrdersController } from './orders.controller';

describe('OrdersController pagination', () => {
  it('should allow 200 rows and cap larger values in the admin list', async () => {
    const ordersService = {
      findManyWithPagination: jest.fn().mockResolvedValue([[], 0]),
    };
    const controller = new OrdersController(
      ordersService as never,
      {} as never,
    );

    await controller.findAll({ page: 1, limit: 200 } as never);
    await controller.findAll({ page: 1, limit: 500 } as never);

    expect(ordersService.findManyWithPagination).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ paginationOptions: { page: 1, limit: 200 } }),
    );
    expect(ordersService.findManyWithPagination).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ paginationOptions: { page: 1, limit: 200 } }),
    );
  });
});
