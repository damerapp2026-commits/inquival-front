import type { Company, FiscalEntity, Quote, QuoteIssuer } from '../../../shared/types';
import { COMPANY_INFO } from '../../../config/companyInfo';

export function getQuoteIssuer(quote: Pick<Quote, 'fiscalEntityId' | 'issuer'>, fiscalEntity?: FiscalEntity, company?: Company): QuoteIssuer {
  const saved = quote.issuer || (quote.fiscalEntityId && quote.fiscalEntityId === fiscalEntity?.id ? fiscalEntity : undefined);
  if (saved) return { legalName: saved.legalName, ruc: saved.ruc, address: saved.address };
  // Quotes issued before company selection retain the existing PDF behavior.
  return {
    legalName: COMPANY_INFO.legalName || company?.name || 'EMPRESA',
    ruc: COMPANY_INFO.ruc || company?.ruc || '',
    address: COMPANY_INFO.address || company?.address || '',
  };
}
