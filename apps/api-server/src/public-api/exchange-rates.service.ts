import { Injectable } from '@nestjs/common';

const CACHE_TTL_MS = 10 * 60 * 1000;
const FAILURE_RETRY_MS = 60 * 1000;
const PROVIDER_URL = 'https://open.er-api.com/v6/latest/CNY';

interface RatesPayload {
  ok: boolean;
  source: string;
  base: string;
  date: string;
  updatedAt: string;
  rates: { RUB: number; USD: number; EUR: number };
  formatted: { cnyRub: string; cnyUsd: string; cnyEur: string };
}

interface ProviderPayload {
  result?: string;
  base_code?: string;
  time_last_update_utc?: string;
  date?: string;
  rates?: Record<string, number | undefined>;
}

const FALLBACK_RATES = { RUB: 11.31, USD: 0.15, EUR: 0.13 };

function formatRate(value: number, symbol: string): string {
  return `${symbol}${value.toFixed(2)}`;
}

function formatRates(rates: RatesPayload['rates']): RatesPayload['formatted'] {
  return {
    cnyRub: formatRate(rates.RUB, '₽'),
    cnyUsd: formatRate(rates.USD, '$'),
    cnyEur: formatRate(rates.EUR, '€'),
  };
}

function isFiniteRate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

@Injectable()
export class ExchangeRatesService {
  private cached: RatesPayload | null = null;
  private expiresAt = 0;
  private inFlight: Promise<RatesPayload> | null = null;

  get(): Promise<RatesPayload> {
    if (this.cached && this.expiresAt > Date.now()) {
      return Promise.resolve(this.cached);
    }
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async refresh(): Promise<RatesPayload> {
    try {
      const response = await fetch(PROVIDER_URL, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`Rate provider responded ${response.status}`);

      const payload = (await response.json()) as ProviderPayload;
      const rates = payload.rates;
      const rub = rates?.RUB;
      const usd = rates?.USD;
      const eur = rates?.EUR;
      if (
        (payload.result && payload.result !== 'success') ||
        (payload.base_code && payload.base_code !== 'CNY') ||
        !isFiniteRate(rub) ||
        !isFiniteRate(usd) ||
        !isFiniteRate(eur)
      ) {
        throw new Error('Rate provider response is incomplete.');
      }

      const updatedAt = new Date().toISOString();
      const result: RatesPayload = {
        ok: true,
        source: 'open.er-api.com',
        base: payload.base_code || 'CNY',
        date: payload.time_last_update_utc || payload.date || updatedAt,
        updatedAt,
        rates: { RUB: rub, USD: usd, EUR: eur },
        formatted: formatRates({ RUB: rub, USD: usd, EUR: eur }),
      };
      this.cache(result, CACHE_TTL_MS);
      return result;
    } catch {
      const cached = this.cached;
      const updatedAt = new Date().toISOString();
      const result: RatesPayload = cached
        ? { ...cached, ok: false }
        : {
            ok: false,
            source: 'fallback',
            base: 'CNY',
            date: updatedAt,
            updatedAt,
            rates: FALLBACK_RATES,
            formatted: formatRates(FALLBACK_RATES),
          };
      this.cache(result, FAILURE_RETRY_MS);
      return result;
    }
  }

  private cache(value: RatesPayload, ttlMs: number): void {
    this.cached = value;
    this.expiresAt = Date.now() + ttlMs;
  }
}
