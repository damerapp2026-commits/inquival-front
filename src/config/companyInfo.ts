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

export interface CompanyInfo {
  legalName: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl: string;
  bankAccounts: BankAccount[];
  yape?: WalletInfo;
  plin?: WalletInfo;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  legalName: 'Inquival',
  ruc: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '/Icon/logosin.png',
  bankAccounts: [],
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
  });
}
