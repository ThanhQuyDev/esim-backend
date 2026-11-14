import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PlansService } from '../plans/plans.service';

/**
 * vande-1411 #008: the cart let the quantity of a Viettel / domestic plan go
 * past the eSIMs left, and the order went through. The server now refuses it.
 */
describe('Tồn kho eSIM nội địa (vande-1411 #008)', () => {
  const viettel = {
    id: 7,
    name: 'Viettel 3T5G150N',
    isLocalInventory: true,
  };
  const airalo = { id: 8, name: 'Airalo', isLocalInventory: false };

  function service(stock: Record<number, number | null>) {
    const s = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(s as unknown as Record<string, unknown>, {
      plansService: { stockByPlanIds: jest.fn().mockResolvedValue(stock) },
    });
    return s as unknown as {
      assertLocalStock: (items: unknown[]) => Promise<void>;
    };
  }

  it('should let an order of what is left through', async () => {
    await expect(
      service({ 7: 2 }).assertLocalStock([
        { quantity: 2, plan: viettel },
        { quantity: 50, plan: airalo },
      ]),
    ).resolves.toBeUndefined();
  });

  it('should refuse more than is left, counting every line of the plan', async () => {
    await expect(
      service({ 7: 2 }).assertLocalStock([
        { quantity: 2, plan: viettel },
        { quantity: 1, plan: viettel },
      ]),
    ).rejects.toThrow('chỉ còn 2 eSIM');
  });

  it('should refuse a plan that has none left', async () => {
    await expect(
      service({ 7: 0 }).assertLocalStock([{ quantity: 1, plan: viettel }]),
    ).rejects.toThrow(BadRequestException);
  });

  it('should answer a number for local stock and null for the others', async () => {
    const plans = Object.create(PlansService.prototype) as PlansService;
    Object.assign(plans as unknown as Record<string, unknown>, {
      plansRepository: {
        findById: jest.fn((id: number) =>
          Promise.resolve(id === 7 ? viettel : id === 8 ? airalo : null),
        ),
        countAvailableEsimsByPlanIds: jest
          .fn()
          .mockResolvedValue({ 7: { count: 3, earliestExpiresAt: null } }),
      },
    });
    await expect(plans.stockByPlanIds([7, 8, 9])).resolves.toEqual({
      7: 3,
      8: null,
    });
  });
});
