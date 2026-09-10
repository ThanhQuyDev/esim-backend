import { UsersController } from './users.controller';

describe('UsersController pagination', () => {
  it('should allow 200 rows per page', async () => {
    const usersService = {
      findManyWithPagination: jest.fn().mockResolvedValue([[], 0]),
    };
    const controller = new UsersController(usersService as never);

    await controller.findAll({ page: 1, limit: 200 } as never);

    expect(usersService.findManyWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        paginationOptions: { page: 1, limit: 200 },
      }),
    );
  });

  it('should cap excessive page sizes at 200', async () => {
    const usersService = {
      findManyWithPagination: jest.fn().mockResolvedValue([[], 0]),
    };
    const controller = new UsersController(usersService as never);

    await controller.findAll({ page: 1, limit: 500 } as never);

    expect(usersService.findManyWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        paginationOptions: { page: 1, limit: 200 },
      }),
    );
  });
});
