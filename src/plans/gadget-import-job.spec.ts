import { PlansGadgetkoreaImportService } from './plans-gadgetkorea-import.service';

/**
 * doitac-3010 #008 — a full Gadget price file takes about a minute, longer than
 * the admin's proxy waits, so the import now runs as a background job.
 */
describe('Gadget import as a background job (doitac-3010 #008)', () => {
  function service(
    run: (onProgress: (d: number, t: number) => void) => Promise<unknown>,
  ) {
    const svc = new PlansGadgetkoreaImportService(
      {} as never,
      {} as never,
      {} as never,
    );
    jest
      .spyOn(svc, 'importFromExcel')
      .mockImplementation((_buffer, onProgress) => run(onProgress!) as never);
    return svc;
  }

  it('should answer at once and report progress, then the result', async () => {
    let finish!: (v: unknown) => void;
    const svc = service((onProgress) => {
      onProgress(1200, 2466);
      return new Promise((resolve) => (finish = resolve));
    });

    const job = svc.startImportJob(Buffer.from(''));
    expect(svc.getImportJob(job.id)).toMatchObject({
      status: 'running',
      done: 1200,
      total: 2466,
    });

    finish({ total: 2466, created: 0, updated: 2466, skipped: 0, errors: [] });
    await new Promise((r) => setImmediate(r));
    expect(svc.getImportJob(job.id)).toMatchObject({
      status: 'done',
      result: { updated: 2466 },
    });
  });

  it('should refuse a second file while one is still importing', () => {
    const svc = service(() => new Promise(() => undefined));
    svc.startImportJob(Buffer.from(''));
    expect(() => svc.startImportJob(Buffer.from(''))).toThrow(
      'Đang có một lần nhập file Gadget chưa xong',
    );
  });

  it('should keep the error of a failed import for the page to show', async () => {
    const svc = service(() => Promise.reject(new Error('Sai định dạng file')));
    const job = svc.startImportJob(Buffer.from(''));
    await new Promise((r) => setImmediate(r));
    expect(svc.getImportJob(job.id)).toMatchObject({
      status: 'failed',
      error: 'Sai định dạng file',
    });
  });
});
