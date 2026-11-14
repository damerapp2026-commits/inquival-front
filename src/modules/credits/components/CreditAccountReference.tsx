import type { CreditAccount } from '../../../shared/types';
import { creditAccountLabel, creditSaleReferences } from '../utils/creditReference';

export function CreditAccountReference({ credit }: { credit: CreditAccount }) {
  const label = creditAccountLabel(credit);
  const sales = creditSaleReferences(credit).map(sale => sale.label).join(', ');
  return (
    <span className="block break-words">
      <span>{label}</span>
      {credit.name?.trim() && sales && sales !== label && (
        <span className="block mt-0.5 text-xs font-normal text-gray-500">{sales}</span>
      )}
    </span>
  );
}
