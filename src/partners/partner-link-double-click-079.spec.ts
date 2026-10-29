import { PartnersService } from './partners.service';
import { ValidationPipe } from '@nestjs/common';
import { PartnerLinkStatusEnum } from './partners.enum';
import { RecordClickDto } from './partner-links-public.controller';
import validationOptions from '../utils/validation-options';

/**
 * vande #079: pressing Enter on esim.vn/go/<code> once counted 2 clicks — the
 * address bar fetches the link ahead, then the browser loads it for real. The
 * same device on the same link within a few seconds is one visit.
 */
function buildService(recent: { clickId: string } | null) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const repos = {
    linkClickRepository: {
      findOne: jest.fn().mockResolvedValue(recent),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((row: object) => row),
    },
    linkRepository: {
      findOne: jest.fn().mockResolvedValue({
        id: 11,
        code: 'VANA2026',
        status: PartnerLinkStatusEnum.ACTIVE,
        targetPath: '/esim/japan',
      }),
      increment: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
  };
  Object.assign(service, repos);
  return { service, ...repos };
}

const visitor = { ipHash: 'abc123', userAgent: 'Mozilla/5.0 Chrome/141' };

describe('PartnersService.recordClick — one visit, one click (vande #079)', () => {
  it('should not count the same device opening the link again moments later', async () => {
    const { service, linkClickRepository, linkRepository } = buildService({
      clickId: 'a'.repeat(32),
    });

    const result = await service.recordClick('VANA2026', visitor);

    expect(linkRepository.increment).not.toHaveBeenCalled();
    expect(linkClickRepository.save).not.toHaveBeenCalled();
    // The visitor still gets the click already recorded for them.
    expect(result).toMatchObject({
      clickId: 'a'.repeat(32),
      targetPath: '/esim/japan',
    });
    expect(result?.clickToken).toBeTruthy();
  });

  it('should count a device with no recent click on the link', async () => {
    const { service, linkClickRepository, linkRepository } = buildService(null);

    await service.recordClick('VANA2026', visitor);

    expect(linkClickRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ linkId: 11 }),
      }),
    );
    expect(linkClickRepository.save).toHaveBeenCalledTimes(1);
    expect(linkRepository.increment).toHaveBeenCalledWith(
      { id: 11 },
      'clickCount',
      1,
    );
  });

  it('should count every click when the device cannot be told apart', async () => {
    const { service, linkClickRepository, linkRepository } = buildService({
      clickId: 'a'.repeat(32),
    });

    await service.recordClick('VANA2026', {});

    expect(linkClickRepository.findOne).not.toHaveBeenCalled();
    expect(linkRepository.increment).toHaveBeenCalledTimes(1);
  });
});

describe('POST /partner-links/:code/click body (vande #079)', () => {
  it('should keep the IP hash and browser the site sends', async () => {
    const pipe = new ValidationPipe(validationOptions);

    const body = (await pipe.transform(
      {
        ipHash: 'abc123',
        userAgent: 'Mozilla/5.0 Chrome/141',
        referrer: 'https://facebook.com/',
      },
      { type: 'body', metatype: RecordClickDto },
    )) as RecordClickDto;

    // The global pipe used to strip all three, as the class had no rules.
    expect(body).toMatchObject({
      ipHash: 'abc123',
      userAgent: 'Mozilla/5.0 Chrome/141',
      referrer: 'https://facebook.com/',
    });
  });
});
