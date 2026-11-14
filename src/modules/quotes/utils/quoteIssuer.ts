import type { Company, FiscalEntity, Quote, QuoteIssuer } from '../../../shared/types';
import { COMPANY_INFO, type CompanyInfo } from '../../../config/companyInfo';

export function getQuotePaymentMethods(quote: Pick<Quote, 'fiscalEntityId'>, fiscalEntity?: FiscalEntity):
  Pick<CompanyInfo, 'bankAccounts' | 'detraccionAccount' | 'yape' | 'plin'> {
  if (quote.fiscalEntityId) {
    return { bankAccounts: quote.fiscalEntityId === fiscalEntity?.id ? fiscalEntity.bankAccounts ?? [] : [] };
  }
  return {
    bankAccounts: COMPANY_INFO.bankAccounts,
    detraccionAccount: COMPANY_INFO.detraccionAccount,
    yape: COMPANY_INFO.yape,
    plin: COMPANY_INFO.plin,
  };
}

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
