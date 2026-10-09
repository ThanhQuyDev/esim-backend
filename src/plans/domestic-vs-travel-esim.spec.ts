import { PlansService } from './plans.service';
import { Plan } from './domain/plan';

/**
 * Tách "eSIM nội địa" khỏi "eSIM du lịch của nhà mạng trong nước".
 *
 * Trước đây cả hai cùng đi qua `isLocalInventory`, nên 3 gói eSIM du lịch của
 * Viettel bị đẩy vào tab "eSIM nội địa" và biến mất khỏi Quốc gia → Việt Nam.
 * Mỗi ca ở đây canh đúng một hướng của sự nhầm đó.
 */
describe('eSIM nội địa vs eSIM du lịch nhà mạng trong nước', () => {
  const plan = (over: Partial<Plan>): Plan =>
    ({
      id: 1,
      name: 'Goi',
      type: 'daily',
      // The plan the de-duplication kept — this spec is about the domestic /
      // travel split, not about which duplicate wins.
      isCheapest: true,
      isLocalInventory: false,
      isDomesticEsim: false,
      sms: null,
      call: null,
      provider: 'viettel',
      ...over,
    }) as Plan;

  /** Gọi hàm nhóm qua một method công khai có dùng nó. */
  const group = (plans: Plan[]) => {
    const service = Object.create(PlansService.prototype) as PlansService;
    const internals = service as unknown as Record<string, unknown>;
    internals.attachStorefrontFacts = jest.fn().mockResolvedValue(plans);
    internals.plansRepository = {
      findManyWithPagination: jest
        .fn()
        .mockResolvedValue([plans, plans.length]),
    };
    return service;
  };

  describe('gói du lịch của nhà mạng trong nước (Viettel)', () => {
    it('should list a Viettel travel plan under the travel groups, not the domestic tab', async () => {
      // Viettel giữ isLocalInventory (giá VND, hàng mình giữ) nhưng KHÔNG phải
      // eSIM nội địa — nó là gói du lịch ở Quốc gia → Việt Nam.
      const viettel = plan({
        name: 'Viettel 5GB / Day - 7Days',
        type: 'daily',
        isLocalInventory: true,
        isDomesticEsim: false,
      });

      const service = group([viettel]);
      const groups = await service.findLocalPlansByCarrier('viettel');

      expect(groups.slowUnlimited).toHaveLength(1);
      expect(groups.localEsim).toHaveLength(0);
    });

    it('should keep isLocalInventory out of the grouping decision entirely', async () => {
      // Một gói giá VND nhưng không phải nội địa vẫn phải vào nhóm du lịch
      // theo đúng `type` của nó.
      const service = group([
        plan({ type: 'fixed', isCheapest: true, isLocalInventory: true }),
        plan({ type: 'unlimited', isLocalInventory: true }),
      ]);
      const groups = await service.findLocalPlansByCarrier('viettel');

      expect(groups.dataPlans).toHaveLength(1);
      expect(groups.dailyUnlimited).toHaveLength(1);
      expect(groups.localEsim).toHaveLength(0);
    });
  });

  describe('eSIM nội địa (Wintel / iTEL / VNSKY)', () => {
    it('should put a domestic plan in the domestic tab and nowhere else', async () => {
      const wintel = plan({
        provider: 'wintel',
        type: 'daily',
        isLocalInventory: true,
        isDomesticEsim: true,
      });

      const service = group([wintel]);
      const groups = await service.findLocalPlansByCarrier('wintel');

      expect(groups.localEsim).toHaveLength(1);
      expect(groups.slowUnlimited).toHaveLength(0);
      expect(groups.dataPlans).toHaveLength(0);
      expect(groups.dailyUnlimited).toHaveLength(0);
    });

    it('should not drop a domestic plan into the SMS/call group', async () => {
      // Gói nội địa có thoại vẫn thuộc tab nội địa, không phải nhóm gói gọi
      // của hàng du lịch.
      const service = group([
        plan({ isDomesticEsim: true, isLocalInventory: true, call: 100 }),
      ]);
      const groups = await service.findLocalPlansByCarrier('wintel');

      expect(groups.localEsim).toHaveLength(1);
      expect(groups.SmsCallEsim).toHaveLength(0);
    });
  });

  describe('hai loại nằm cạnh nhau', () => {
    it('should split a mixed list down the isDomesticEsim line', async () => {
      const service = group([
        plan({ provider: 'viettel', type: 'daily', isLocalInventory: true }),
        plan({
          provider: 'wintel',
          type: 'daily',
          isLocalInventory: true,
          isDomesticEsim: true,
        }),
        plan({ provider: 'airalo', type: 'fixed', isCheapest: true }),
      ]);
      const groups = await service.findLocalPlansByCarrier('any');

      // Viettel + Airalo là hàng du lịch; chỉ Wintel vào tab nội địa.
      expect(groups.slowUnlimited).toHaveLength(1);
      expect(groups.dataPlans).toHaveLength(1);
      expect(groups.localEsim).toHaveLength(1);
      expect(groups.localEsim[0].provider).toBe('wintel');
    });
  });

  describe('trang chi tiết từng nhà mạng', () => {
    it('should query by isDomesticEsim, never by isLocalInventory', async () => {
      // Lọc theo isLocalInventory sẽ làm /esim-noi-dia/viettel trả về gói du
      // lịch của Viettel như thể chúng là gói nội địa.
      const plans = [plan({ isDomesticEsim: true, isLocalInventory: true })];
      const service = group(plans);
      const repo = (service as unknown as Record<string, any>).plansRepository;

      await service.findLocalPlansByCarrier('wintel');

      const arg = repo.findManyWithPagination.mock.calls[0][0];
      expect(arg.filterOptions.isDomesticEsim).toBe(true);
      expect(arg.filterOptions.isLocalInventory).toBeUndefined();
    });
  });
});
