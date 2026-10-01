import { BadRequestException } from '@nestjs/common';
import { AuthPagesService } from './auth-pages.service';

/**
 * #006 — "Cho phép thay đổi logo, hình ảnh, và phần nội dung mẫu khởi đầu ở
 * trang đăng nhập admin và đối tác".
 */
describe('AuthPagesService', () => {
  type Row = {
    mode: string;
    logoUrl?: string | null;
    logoText?: string | null;
    coverImageUrl?: string | null;
    quote?: string | null;
    quoteAuthor?: string | null;
    heading?: string | null;
    subheading?: string | null;
    updatedAt?: Date;
  };

  function setup(rows: Row[] = []) {
    const store = new Map(rows.map((row) => [row.mode, { ...row }]));
    const repository = {
      find: jest
        .fn()
        .mockImplementation(() => Promise.resolve([...store.values()])),
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: { mode: string } }) =>
          Promise.resolve(store.get(where.mode) ?? null),
        ),
      create: jest.fn().mockImplementation((data: Row) => data),
      save: jest.fn().mockImplementation((data: Row) => {
        store.set(data.mode, { ...data });
        return Promise.resolve(data);
      }),
    };
    const service = new AuthPagesService(repository as never);
    return { service, repository, store };
  }

  it('should returns a row for both deployments even when the table is empty', async () => {
    const { service } = setup();

    const list = await service.findAll();

    expect(list.map((row) => row.mode)).toEqual(['admin', 'partner']);
    expect(list[0].quote).toBeNull();
  });

  it('should rejects a mode that is not one of the two deployments', async () => {
    const { service } = setup();

    await expect(service.findOne('reseller')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.update('reseller', { heading: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should creates the row on first save and trims what it stores', async () => {
    const { service } = setup();

    const saved = await service.update('partner', {
      heading: '  Đăng nhập đối tác  ',
      logoUrl: ' https://cdn/logo.png ',
    });

    expect(saved).toMatchObject({
      mode: 'partner',
      heading: 'Đăng nhập đối tác',
      logoUrl: 'https://cdn/logo.png',
    });
  });

  it('should leaves fields absent from the body untouched', async () => {
    const { service } = setup([
      { mode: 'admin', heading: 'Cũ', quote: 'Giữ nguyên câu này' },
    ]);

    const saved = await service.update('admin', { heading: 'Mới' });

    expect(saved.heading).toBe('Mới');
    expect(saved.quote).toBe('Giữ nguyên câu này');
  });

  it('should treats an emptied field as "back to the built-in default"', async () => {
    const { service } = setup([
      { mode: 'admin', coverImageUrl: 'https://cdn/old.png' },
    ]);

    const saved = await service.update('admin', { coverImageUrl: '   ' });

    expect(saved.coverImageUrl).toBeNull();
  });

  it('should does not mix the two deployments up', async () => {
    const { service } = setup();

    await service.update('admin', { heading: 'Quản trị' });
    await service.update('partner', { heading: 'Đối tác' });

    const list = await service.findAll();
    expect(list.find((row) => row.mode === 'admin')?.heading).toBe('Quản trị');
    expect(list.find((row) => row.mode === 'partner')?.heading).toBe('Đối tác');
  });
});
