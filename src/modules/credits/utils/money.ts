import type { Sale } from '../../../shared/types';

export type MoneyCurrency = 'PEN' | 'USD';

export function creditCurrency(currency?: string): MoneyCurrency {
  return currency === 'USD' ? 'USD' : 'PEN';
}

export function moneySymbol(currency?: string): string {
  return creditCurrency(currency) === 'USD' ? '$' : 'S/';
}

export function formatMoney(amount: number, currency?: string): string {
  return `${moneySymbol(currency)} ${(amount || 0).toFixed(2)}`;
}

export function saleCurrencyAmount(sale: Pick<Sale, 'currency' | 'exchangeRate'>, pen: number, usd?: number): number | undefined {
  if (sale.currency !== 'USD') return pen;
  if (usd != null) return usd;
  return sale.exchangeRate && sale.exchangeRate > 0 ? pen / sale.exchangeRate : undefined;
}
