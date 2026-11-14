import type { CreditAccount, CreditSaleDetail } from '../../../shared/types';

type AccountReference = Pick<CreditAccount, 'name' | 'saleIds' | 'saleDetails'>;

export function creditSaleLabel(sale: Partial<Pick<CreditSaleDetail, 'saleId' | 'saleNumber'>>): string {
  const number = sale.saleNumber?.trim();
  const id = sale.saleId?.trim();
  return number || (id ? `Venta sin número (${id.slice(-8).toUpperCase()})` : 'Venta sin número');
}

export function creditSaleReferences(credit: AccountReference) {
  const details = new Map((credit.saleDetails || []).map(sale => [sale.saleId, sale]));
  const ids = new Set([...(credit.saleIds || []), ...details.keys()].filter(Boolean));
  return [...ids].map(saleId => ({ saleId, label: creditSaleLabel(details.get(saleId) || { saleId }) }));
}

export function creditAccountLabel(credit: AccountReference): string {
  return credit.name?.trim() || creditSaleReferences(credit).map(sale => sale.label).join(', ') || 'Sin venta vinculada';
}

export function creditAccountText(credit: AccountReference): string {
  const label = creditAccountLabel(credit);
  const sales = creditSaleReferences(credit).map(sale => sale.label).join(', ');
  return credit.name?.trim() && sales && sales !== label ? `${label} · ${sales}` : label;
}
