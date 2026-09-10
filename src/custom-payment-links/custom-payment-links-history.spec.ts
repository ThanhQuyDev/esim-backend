import { CustomPaymentLinksController } from './custom-payment-links.controller';
import { CustomPaymentLinksService } from './custom-payment-links.service';
import { CustomPaymentLinkStatus } from './custom-payment-links.enum';
import { FindAllCustomPaymentLinksDto } from './dto/find-all-custom-payment-links.dto';

/**
 * History of custom payment orders (#084).
 *
 * The CMS page kept its own in-memory list, so a refresh lost everything and
 * the status never caught up with the payment. It now reads this endpoint,
 * which has to answer with the newest first, honour the status filter, and
 * report a total the page can page through.
 */
describe('CustomPaymentLinksController — history listing', () => {
  function setup(rows: unknown[] = [], count = 0) {
    const findAllWithPagination = jest.fn().mockResolvedValue([rows, count]);
    const service = {
      findAllWithPagination,
    } as unknown as CustomPaymentLinksService;
    return {
      controller: new CustomPaymentLinksController(service),
      findAllWithPagination,
    };
  }

  function query(overrides: Partial<FindAllCustomPaymentLinksDto> = {}) {
    return overrides as FindAllCustomPaymentLinksDto;
  }

  it('should default to the first page', async () => {
    const { controller, findAllWithPagination } = setup();

    await controller.findAll(query());

    expect(findAllWithPagination).toHaveBeenCalledWith({
      paginationOptions: { page: 1, limit: 10 },
      filterOptions: { status: undefined, search: undefined },
    });
  });

  it('should pass the status filter through', async () => {
    const { controller, findAllWithPagination } = setup();

    await controller.findAll(query({ status: CustomPaymentLinkStatus.PAID }));

    expect(findAllWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        filterOptions: { status: 'PAID', search: undefined },
      }),
    );
  });

  it('should pass the search term through', async () => {
    const { controller, findAllWithPagination } = setup();

    await controller.findAll(query({ search: 'khach@example.com' }));

    expect(findAllWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        filterOptions: { status: undefined, search: 'khach@example.com' },
      }),
    );
  });

  it('should cap the page size, so one call cannot pull the whole table', async () => {
    const { controller, findAllWithPagination } = setup();

    await controller.findAll(query({ page: 3, limit: 500 }));

    expect(findAllWithPagination).toHaveBeenCalledWith(
      expect.objectContaining({
        paginationOptions: { page: 3, limit: 50 },
      }),
    );
  });

  it('should report the total behind the filter, not the page size', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `link-${i}` }));
    const { controller } = setup(rows, 137);

    const result = await controller.findAll(query({ page: 1, limit: 10 }));

    expect(result.data).toHaveLength(10);
    expect(result.totalCount).toBe(137);
    expect(result.hasNextPage).toBe(true);
  });

  it('should stop paging on the last, short page', async () => {
    const { controller } = setup([{ id: 'link-1' }], 21);

    const result = await controller.findAll(query({ page: 3, limit: 10 }));

    expect(result.hasNextPage).toBe(false);
    expect(result.totalCount).toBe(21);
  });
});
