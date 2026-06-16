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
