import { BadRequestException } from '@nestjs/common';
import {
  partnerPurchaseQuote,
  partnerPurchaseUnitPriceVnd,
} from './partner-purchase';
import { normalizeCostMarkupRanges } from './partners.service';

/**
 * doitac-3010 #040 — a distribution tier's markup by cost band, like the
 * admin's Profit Margin Tier, and an agent price that never goes above the
 * web's price (a flat % on a 1 triệu+ eSIM did).
 */
describe('Partner tier markup by cost band (doitac-3010 #040)', () => {
  const markup = {
    percent: 10,
    ranges: [
      { fromVnd: 0, toVnd: 999_999, percent: 15, fixedVnd: 0 },
      { fromVnd: 1_000_000, toVnd: 5_000_000, percent: 0, fixedVnd: 50_000 },
    ],
  };

  it('should add the % of the band the cost falls in', () => {
    expect(partnerPurchaseUnitPriceVnd(200_000, markup)).toBe(230_000);
  });

  it('should add the fixed sum of a band that has one', () => {
    expect(partnerPurchaseUnitPriceVnd(1_200_000, markup)).toBe(1_250_000);
  });

  it('should take both ends of a band as inside it', () => {
    expect(partnerPurchaseUnitPriceVnd(1_000_000, markup)).toBe(1_050_000);
    expect(partnerPurchaseUnitPriceVnd(5_000_000, markup)).toBe(5_050_000);
  });

  it('should fall back to the flat % for a cost outside every band', () => {
    expect(partnerPurchaseUnitPriceVnd(6_000_000, markup)).toBe(6_600_000);
  });

  it('should still read a tier with only the flat %', () => {
    expect(partnerPurchaseUnitPriceVnd(100_000, 10)).toBe(110_000);
    expect(partnerPurchaseUnitPriceVnd(100_000, { percent: 10 })).toBe(110_000);
  });

  it('should never price above the web price', () => {
    // A 1.5 triệu eSIM the web sells at 1.6 triệu: +10% would be 1.65 triệu.
    expect(partnerPurchaseUnitPriceVnd(1_500_000, 10, 1_600_000)).toBe(
      1_600_000,
    );
    const quote = partnerPurchaseQuote({
      unitCostVnd: 1_500_000,
      costMarkupPercent: 10,
      listPriceVnd: 1_600_000,
      quantity: 2,
    });
    expect(quote.unitPriceVnd).toBe(1_600_000);
    expect(quote.marginVnd).toBe(0);
  });

  it('should keep the agent price at or below the web price for any cost, band and %', () => {
    let seed = 40;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2000; i++) {
      const cost = Math.round(rand() * 10_000_000);
      const list = Math.round((cost * (1 + rand() * 0.4)) / 1000) * 1000;
      const tier = {
        percent: rand() * 60,
        ranges: [
          { fromVnd: 0, toVnd: 2_000_000, percent: rand() * 60, fixedVnd: 0 },
          {
            fromVnd: 2_000_001,
            toVnd: 8_000_000,
            percent: 0,
            fixedVnd: Math.round(rand() * 2_000_000),
          },
        ],
      };
      if (list > 0) {
        expect(
          partnerPurchaseUnitPriceVnd(cost, tier, list),
        ).toBeLessThanOrEqual(list);
      }
    }
  });

  it('should save the bands in price order', () => {
    expect(
      normalizeCostMarkupRanges([
        { fromVnd: 1_000_000, toVnd: 2_000_000, percent: 5, fixedVnd: 0 },
        { fromVnd: 0, toVnd: 999_999, percent: 10, fixedVnd: 0 },
      ]).map((r) => r.fromVnd),
    ).toEqual([0, 1_000_000]);
  });

  it('should refuse a band whose "từ" is above its "đến"', () => {
    expect(() =>
      normalizeCostMarkupRanges([
        { fromVnd: 500_000, toVnd: 100_000, percent: 5, fixedVnd: 0 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('should refuse two bands covering the same cost', () => {
    expect(() =>
      normalizeCostMarkupRanges([
        { fromVnd: 0, toVnd: 1_000_000, percent: 10, fixedVnd: 0 },
        { fromVnd: 1_000_000, toVnd: 2_000_000, percent: 5, fixedVnd: 0 },
      ]),
    ).toThrow(/trùng/);
  });
});
