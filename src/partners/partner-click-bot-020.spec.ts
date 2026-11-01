import { PartnersService } from './partners.service';
import { PartnerLinkStatusEnum } from './partners.enum';
import {
  CLICK_RATE_HARD_LIMIT,
  CLICK_RATE_SOFT_LIMIT,
  clickBotScore,
  knownBotFlags,
} from './partner-click-bot-score';

/**
 * doitac-3010 #020, rule 4 — a bot that calls itself "Mozilla/5.0" gets past
 * the user-agent list, so the click is judged on its headers, its network and
 * how often that network clicks; the score follows it to the order.
 */
function buildService(recentFromNetwork = 0, stored: object | null = null) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const repos = {
    linkClickRepository: {
      findOne: jest.fn().mockResolvedValue(stored),
      count: jest.fn().mockResolvedValue(recentFromNetwork),
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
    logger: { warn: jest.fn(), error: jest.fn() },
  };
  Object.assign(service, repos);
  return { service, ...repos };
}

const visitor = { ipHash: 'net1', userAgent: 'Mozilla/5.0 Chrome/141' };

describe('Click bot score (doitac-3010 #020)', () => {
  it('should keep only the reasons it knows', () => {
    expect(
      knownBotFlags(['datacenter_ip', 'made_up', 7, 'datacenter_ip']),
    ).toEqual(['datacenter_ip']);
  });

  it('should add the reasons up, never past 100', () => {
    expect(clickBotScore([])).toBe(0);
    expect(clickBotScore(['no_accept_language', 'no_fetch_metadata'])).toBe(50);
    expect(
      clickBotScore([
        'no_accept_language',
        'accept_not_html',
        'no_fetch_metadata',
        'datacenter_ip',
      ]),
    ).toBe(100);
  });

  it('should store a fake browser with its score and reasons', async () => {
    const { service, linkClickRepository } = buildService();
    await service.recordClick('VANA2026', {
      ...visitor,
      botFlags: ['no_accept_language', 'datacenter_ip'],
    });
    expect(linkClickRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        botScore: 65,
        botFlags: 'no_accept_language,datacenter_ip',
      }),
    );
  });

  it('should store a real browser with nothing against it', async () => {
    const { service, linkClickRepository } = buildService();
    await service.recordClick('VANA2026', visitor);
    expect(linkClickRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ botScore: 0, botFlags: null }),
    );
  });

  it('should mark a network that clicks far more often than a person', async () => {
    const { service, linkClickRepository } = buildService(
      CLICK_RATE_SOFT_LIMIT,
    );
    await service.recordClick('VANA2026', visitor);
    expect(linkClickRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ botScore: 30, botFlags: 'high_rate' }),
    );
  });

  it('should not count a flood from one network at all', async () => {
    const { service, linkClickRepository, linkRepository } = buildService(
      CLICK_RATE_HARD_LIMIT,
    );
    const result = await service.recordClick('VANA2026', visitor);
    expect(result).toEqual({
      targetPath: '/esim/japan',
      clickId: null,
      clickToken: null,
    });
    expect(linkClickRepository.save).not.toHaveBeenCalled();
    expect(linkRepository.increment).not.toHaveBeenCalled();
  });

  it('should report a bot-like click to the order, and stay quiet for a human one', async () => {
    const id = 'd'.repeat(32);
    const bot = buildService(0, {
      botScore: 65,
      botFlags: 'no_accept_language,datacenter_ip',
    });
    await expect(bot.service.clickBotSignals(id)).resolves.toEqual({
      score: 65,
      flags: ['no_accept_language', 'datacenter_ip'],
    });

    const human = buildService(0, {
      botScore: 15,
      botFlags: 'no_client_hints',
    });
    await expect(human.service.clickBotSignals(id)).resolves.toBeNull();
    await expect(human.service.clickBotSignals(null)).resolves.toBeNull();
  });
});
