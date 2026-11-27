// Unit normalization. Canonical units: centimetres, kilograms, ISO-4217 currency codes.
// Anything not recognized returns undefined (the caller records it as missing/not_extracted);
// nothing is guessed. `converted` marks values whose published unit differed from the canonical one.
import type { Money } from '../../../shared/discovery.ts';

export interface Normalized { value: number; original: string; converted: boolean }

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export function parseLengthCm(text: string | undefined): Normalized | undefined {
  if (!text) return undefined;
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|in|inch|inches|"|″)\s*$/i.exec(text);
  if (!m) return undefined;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  const unit = m[2].toLowerCase();
  const factor = unit === 'mm' ? 0.1 : unit === 'cm' ? 1 : unit === 'm' ? 100 : 2.54;
  return { value: round(n * factor), original: text.trim(), converted: unit !== 'cm' };
}

export function parseWeightKg(text: string | undefined): Normalized | undefined {
  if (!text) return undefined;
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(kg|g|lb|lbs)\s*$/i.exec(text);
  if (!m) return undefined;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  const unit = m[2].toLowerCase();
  const factor = unit === 'kg' ? 1 : unit === 'g' ? 0.001 : 0.45359237;
  return { value: round(n * factor, 3), original: text.trim(), converted: unit !== 'kg' };
}

/** Amount and currency always travel together; either missing or invalid means no price. */
export function parseMoney(amount: string | number | undefined, currency: string | undefined): Money | undefined {
  if (amount === undefined || amount === null || amount === '' || !currency) return undefined;
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return undefined;
  const n = typeof amount === 'number' ? amount : Number(String(amount).replace(/[\s,]/g, ''));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return { amount: n, currency: code };
}
