import { readFileSync } from 'fs';
import { join } from 'path';
import { EsimsService } from './esims.service';

/** vande-0411 #029 — every eSIM gets its turn, and the run happens once. */
describe('Usage refresh rotation (vande-0411 #029)', () => {
  function service(due: { id: number; provider: string }[]) {
    const repository = {
      findDueForUsageRefresh: jest.fn().mockResolvedValue(due),
      markUsageChecked: jest.fn().mockResolvedValue(undefined),
    };
    const svc = Object.create(EsimsService.prototype) as EsimsService;
    const getDataUsage = jest.fn().mockResolvedValue({});
    Object.assign(svc, {
      esimsRepository: repository,
      logger: { log: jest.fn(), warn: jest.fn() },
      getDataUsage,
    });
    return { svc, repository, getDataUsage };
  }

  it('should mark each eSIM as asked', async () => {
    const { svc, repository } = service([
      { id: 1, provider: 'microesim' },
      { id: 2, provider: 'airalo' },
    ]);

    await svc.refreshActiveEsimUsage();

    expect(repository.markUsageChecked.mock.calls).toEqual([[1], [2]]);
  });

  it('should end its turn even when the supplier fails', async () => {
    const { svc, repository, getDataUsage } = service([
      { id: 1, provider: 'microesim' },
    ]);
    getDataUsage.mockRejectedValue(new Error('supplier down'));

    await svc.refreshActiveEsimUsage();

    expect(repository.markUsageChecked).toHaveBeenCalledWith(1);
  });

  it('should register the scheduler once, or every cron runs twice', () => {
    const modules = [
      'app.module.ts',
      'esim-providers/esim-providers.module.ts',
    ];
    const count = modules
      .map((file) => readFileSync(join(__dirname, '..', file), 'utf8'))
      .join('\n')
      .split('ScheduleModule.forRoot(').length;

    expect(count - 1).toBe(1);
  });
});
