import { describe, it, expect } from 'vitest';
import currency from '../app/src/pkjs/agent/tools/currency.js';

describe('currency names', () => {
  it('maps common names and symbols to ISO codes', () => {
    expect(currency.normalizeCurrency('dollars')).toBe('USD');
    expect(currency.normalizeCurrency('US dollars')).toBe('USD');
    expect(currency.normalizeCurrency('€')).toBe('EUR');
    expect(currency.normalizeCurrency('pounds')).toBe('GBP');
    expect(currency.normalizeCurrency('yen')).toBe('JPY');
  });

  it('keeps explicit codes', () => {
    expect(currency.normalizeCurrency('CAD')).toBe('CAD');
    expect(currency.normalizeCurrency('eur')).toBe('EUR');
  });

  it('rejects unknown values', () => {
    expect(currency.normalizeCurrency('bananas')).toBe('');
    expect(currency.normalizeCurrency('')).toBe('');
  });
});
