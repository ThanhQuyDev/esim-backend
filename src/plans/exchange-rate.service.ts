import { Injectable, Logger } from '@nestjs/common';

/** Used when the rate API cannot be reached and nothing is cached yet. */
export const FALLBACK_USD_VND_RATE = 25500;

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
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cached: { rate: number; at: number } | null = null;
  /** In-flight request, so a burst of callers shares one fetch. */
  private pending: Promise<number> | null = null;

  /** Current USD→VND rate. Never throws: falls back to the last known value. */
  async getUsdToVndRate(): Promise<number> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.rate;
    }
    if (this.pending) return this.pending;

    this.pending = this.fetchRate().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async fetchRate(): Promise<number> {
    try {
      const res = await fetch(RATE_URL);
      if (!res.ok) {
        this.logger.error(`Exchange rate API error: ${res.status}`);
        return this.staleOrFallback();
      }
      const data = (await res.json()) as { rates?: { VND?: number } };
      const rate = Number(data?.rates?.VND);
      if (!Number.isFinite(rate) || rate <= 0) {
        this.logger.error('VND rate not found in response');
        return this.staleOrFallback();
      }
      this.cached = { rate, at: Date.now() };
      return rate;
    } catch (err) {
      this.logger.error('Failed to fetch USD→VND rate', err);
      return this.staleOrFallback();
    }
  }

  /**
   * A stale rate beats the hardcoded constant: it is off by a day at worst,
   * while the constant can be off by years.
   */
  private staleOrFallback(): number {
    return this.cached?.rate ?? FALLBACK_USD_VND_RATE;
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
