import { FaqsController } from './faqs.controller';

describe('FaqsController pagination', () => {
  it('should allow 200 rows and cap larger values', async () => {
    const faqsService = {
      findAllWithPagination: jest.fn().mockResolvedValue([[], 0]),
    };
    const controller = new FaqsController(faqsService as never);

    await controller.findAll({ page: 1, limit: 200 } as never);
    await controller.findAll({ page: 1, limit: 500 } as never);

    expect(faqsService.findAllWithPagination).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ paginationOptions: { page: 1, limit: 200 } }),
    );
    expect(faqsService.findAllWithPagination).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ paginationOptions: { page: 1, limit: 200 } }),
    );
  });
});
