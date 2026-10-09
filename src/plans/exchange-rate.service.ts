import { Injectable, Logger } from '@nestjs/common';

/** Used when the rate API cannot be reached and nothing is cached yet. */
export const FALLBACK_USD_VND_RATE = 25500;

/**
 * Fallback USD→CNY rate, for Billion's catalogue when the rate API is down.
 *
 * Deliberately a rate we would rather be slightly wrong about in the expensive
 * direction: too high a divisor undersells, too low oversells. Around 7.1 is
 * the long-run level; a stale cached rate is always preferred to this.
 */
export const FALLBACK_USD_CNY_RATE = 7.1;

/**
 * Fallback USD→HKD rate, for Billion's catalogue when the rate API is down.
 * The Hong Kong dollar is pegged to 7.75–7.85 per USD, so this barely moves.
 */
export const FALLBACK_USD_HKD_RATE = 7.8;

const RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * One USD→VND rate for the whole app (#009).
 *
 * Every plan must carry both a VND and a USD figure whatever currency its
 * supplier quotes, and the conversion has to happen the moment a plan is created
 * — an API sync or an Excel upload — not on the next hourly pass. Viettel plans
 * used to sit at `usdPrice = 0` until that pass ran, and an order placed in the
 * meantime recorded a total of 0.
 *
 * The rate is cached for an hour: the import path asks for it once per plan, and
 * hitting the rate API a thousand times per upload would rate-limit us into the
 * fallback.
 */
type Rates = { vnd: number; cny: number; hkd: number };

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cached: { rates: Rates; at: number } | null = null;
  /** In-flight request, so a burst of callers shares one fetch. */
  private pending: Promise<Rates> | null = null;

  /** Current USD→VND rate. Never throws: falls back to the last known value. */
  async getUsdToVndRate(): Promise<number> {
    return (await this.getRates()).vnd;
  }

  /**
   * Current CNY→USD rate, for suppliers who quote in yuan (#billion-currency).
   *
   * Returned as "how many dollars one yuan is" so callers multiply, the same
   * shape as the old hard-coded constant they replace. One fetch serves this
   * and the VND rate — they come from the same response.
   */
  async getCnyToUsdRate(): Promise<number> {
    const { cny } = await this.getRates();
    return 1 / cny;
  }

  /**
   * Current HKD→USD rate, for suppliers who quote in Hong Kong dollars
   * (Billion, #002 test round 4). "How many dollars one HKD is", so callers
   * multiply.
   */
  async getHkdToUsdRate(): Promise<number> {
    const { hkd } = await this.getRates();
    return 1 / hkd;
  }

  private async getRates(): Promise<Rates> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.rates;
    }
    if (this.pending) return this.pending;

    this.pending = this.fetchRates().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async fetchRates(): Promise<Rates> {
    try {
      const res = await fetch(RATE_URL);
      if (!res.ok) {
        this.logger.error(`Exchange rate API error: ${res.status}`);
        return this.staleOrFallback();
      }
      const data = (await res.json()) as {
        rates?: { VND?: number; CNY?: number; HKD?: number };
      };
      const vnd = Number(data?.rates?.VND);
      const cny = Number(data?.rates?.CNY);
      const hkd = Number(data?.rates?.HKD);
      if (!Number.isFinite(vnd) || vnd <= 0) {
        this.logger.error('VND rate not found in response');
        return this.staleOrFallback();
      }
      // A missing CNY does not invalidate a good VND: keep the VND and fall
      // back only on the yuan, rather than throwing both away.
      const rates: Rates = {
        vnd,
        cny:
          Number.isFinite(cny) && cny > 0
            ? cny
            : (this.cached?.rates.cny ?? FALLBACK_USD_CNY_RATE),
        hkd:
          Number.isFinite(hkd) && hkd > 0
            ? hkd
            : (this.cached?.rates.hkd ?? FALLBACK_USD_HKD_RATE),
      };
      this.cached = { rates, at: Date.now() };
      return rates;
    } catch (err) {
      this.logger.error('Failed to fetch exchange rates', err);
      return this.staleOrFallback();
    }
  }

  /**
   * A stale rate beats the hardcoded constant: it is off by a day at worst,
   * while the constant can be off by years.
   */
  private staleOrFallback(): Rates {
    return (
      this.cached?.rates ?? {
        vnd: FALLBACK_USD_VND_RATE,
        cny: FALLBACK_USD_CNY_RATE,
        hkd: FALLBACK_USD_HKD_RATE,
      }
    );
  }
}

/** Rounds to đồng in thousands, the way prices are displayed. */
export function toVnd(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round((amount * rate) / 1000) * 1000;
}

export function toUsd(amountVnd: number, rate: number): number {
  if (!Number.isFinite(amountVnd) || amountVnd <= 0 || rate <= 0) return 0;
  return Math.round((amountVnd / rate) * 100) / 100;
}

/**
 * Both figures for one amount, whichever currency it is quoted in.
 *
 * `currency` is what the supplier quotes; `VND` covers Viettel and the other
 * local inventory that is uploaded by Excel in đồng.
 */
export function convertAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
  rate: number,
): { vnd: number; usd: number } {
  const value = Number(amount) || 0;
  if (value <= 0) return { vnd: 0, usd: 0 };
  if ((currency ?? 'USD').toUpperCase() === 'VND') {
    return { vnd: Math.round(value / 1000) * 1000, usd: toUsd(value, rate) };
  }
  return { vnd: toVnd(value, rate), usd: Math.round(value * 100) / 100 };
}
