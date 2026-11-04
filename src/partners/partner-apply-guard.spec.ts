import { PartnersService } from './partners.service';
import {
  APPLY_IP_LIMIT,
  APPLY_TOTAL_LIMIT,
  isPlausiblePhone,
  isThrowawayEmail,
} from './partner-apply-guard';

/**
 * vande-0411 #006 — the partner application refuses what the form would have
 * refused, whoever posts it. Shapes are those of the 5 spam applications on
 * prod on 03/11: throwaway domains, no main channel.
 */
const GOOD = {
  partnerType: 'kol',
  legalType: 'individual',
  contactName: 'Nguyen Van A',
  contactPhone: '0901 234 567',
  contactEmail: 'van.a@gmail.com',
  password: 'S3cret123!',
  channelInfo: { channel: 'tiktok' },
};

function build() {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const findOne = jest.fn().mockResolvedValue({ id: 1 });
  Object.assign(service, {
    userRepository: { findOne },
    // Ends every accepted call at the "email already used" branch, so nothing
    // here creates anything.
    partnerRepository: { findOne: jest.fn().mockResolvedValue(null) },
  });
  return { service, findOne };
}

const codeOf = async (run: Promise<unknown>) => {
  try {
    await run;
    return null;
  } catch (err) {
    return (
      err as { getResponse(): { errors: Record<string, string> } }
    ).getResponse().errors;
  }
};

describe('Chống spam đăng ký đối tác (vande-0411 #006)', () => {
  it('should let a real application through', async () => {
    const { service } = build();
    expect(await codeOf(service.apply(GOOD as never))).toEqual({
      contactEmail: 'emailAlreadyExists',
    });
  });

  it.each([
    ['no main channel', { channelInfo: undefined }, 'channel'],
    ['an empty main channel', { channelInfo: { channel: ' ' } }, 'channel'],
    ['a throwaway email', { contactEmail: 'x@mailinator.com' }, 'contactEmail'],
    [
      'a throwaway email in capitals',
      { contactEmail: 'x@GuerrillaMailBlock.com' },
      'contactEmail',
    ],
    ['a phone of letters', { contactPhone: 'abcdefghij' }, 'contactPhone'],
    ['a short phone', { contactPhone: '12345' }, 'contactPhone'],
    ['a blank name', { contactName: '   ' }, 'contactName'],
    ['the hidden field filled', { website: 'x' }, 'application'],
    [
      'a company with no name',
      { legalType: 'company', taxCode: '0312345678' },
      'companyName',
    ],
    [
      'a company with no tax code',
      { legalType: 'company', companyName: 'ABC' },
      'taxCode',
    ],
  ])('should refuse %s', async (_name, change, field) => {
    const { service, findOne } = build();
    const errors = await codeOf(service.apply({ ...GOOD, ...change } as never));
    expect(Object.keys(errors ?? {})).toEqual([field]);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('should limit one address, and leave another alone', async () => {
    const { service } = build();
    for (let i = 0; i < APPLY_IP_LIMIT; i++) {
      await codeOf(service.apply(GOOD as never, '1.2.3.4'));
    }
    expect(await codeOf(service.apply(GOOD as never, '1.2.3.4'))).toEqual({
      application: 'tooManyApplications',
    });
    expect(await codeOf(service.apply(GOOD as never, '5.6.7.8'))).toEqual({
      contactEmail: 'emailAlreadyExists',
    });
  });

  it('should not count our own proxy as one visitor', async () => {
    const { service } = build();
    for (let i = 0; i < APPLY_IP_LIMIT + 3; i++) {
      expect(await codeOf(service.apply(GOOD as never, '127.0.0.1'))).toEqual({
        contactEmail: 'emailAlreadyExists',
      });
    }
  });

  it('should stop a script that changes its address every time', async () => {
    const { service } = build();
    for (let i = 0; i < APPLY_TOTAL_LIMIT; i++) {
      await codeOf(service.apply(GOOD as never, `9.9.9.${i}`));
    }
    expect(await codeOf(service.apply(GOOD as never, '8.8.8.8'))).toEqual({
      application: 'tooManyApplications',
    });
  });

  it('should not spend the limit on a form with a mistake in it', async () => {
    const { service } = build();
    for (let i = 0; i < APPLY_IP_LIMIT + 3; i++) {
      await codeOf(
        service.apply({ ...GOOD, contactPhone: 'x' } as never, '1.2.3.4'),
      );
    }
    expect(await codeOf(service.apply(GOOD as never, '1.2.3.4'))).toEqual({
      contactEmail: 'emailAlreadyExists',
    });
  });

  it('should accept the phones and emails people really use', () => {
    for (const phone of ['0901234567', '+84 901 234 567', '(028) 3822-1234']) {
      expect(isPlausiblePhone(phone)).toBe(true);
    }
    for (const email of ['a@gmail.com', 'sales@company.com.vn']) {
      expect(isThrowawayEmail(email)).toBe(false);
    }
  });
});
