export interface BankAccount {
  bank: string;
  currency: 'PEN' | 'USD';
  accountNumber: string;
  cci?: string;
  holder: string;
}

export interface WalletInfo {
  number: string;
  holder: string;
}

export interface DetraccionAccountInfo {
  bank: string;
  accountNumber: string;
}

export interface CompanyInfo {
  legalName: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  salesEmail?: string;
  website?: string;
  logoUrl: string;
  bankAccounts: BankAccount[];
  detraccionAccount?: DetraccionAccountInfo;
  yape?: WalletInfo;
  plin?: WalletInfo;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  legalName: 'Inquival',
  ruc: '',
  address: '',
  phone: '',
  email: '',
  salesEmail: 'clientesquiven@outlook.es',
  website: '',
  logoUrl: '/pwa-192x192.png',
  bankAccounts: [],
  detraccionAccount: {
    bank: 'Banco de la Nación',
    accountNumber: '00771130054',
  },
  yape: undefined,
  plin: undefined,
};

export const COMPANY_INFO: CompanyInfo = { ...DEFAULT_COMPANY_INFO };

export function setCompanyInfo(next: Partial<CompanyInfo>): void {
  Object.assign(COMPANY_INFO, {
    ...DEFAULT_COMPANY_INFO,
    ...next,
    logoUrl: next.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
    bankAccounts: next.bankAccounts ?? [],
    salesEmail: next.salesEmail || DEFAULT_COMPANY_INFO.salesEmail,
    detraccionAccount: next.detraccionAccount?.accountNumber
      ? next.detraccionAccount
      : DEFAULT_COMPANY_INFO.detraccionAccount,
  });
}
