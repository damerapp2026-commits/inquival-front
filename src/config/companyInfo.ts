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

export const COMPANY_INFO: CompanyInfo = {
  legalName: 'Inquival',
  ruc: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '/Icon/logosin.png',
  bankAccounts: [
    // { bank: 'BCP',       currency: 'PEN', accountNumber: '...', cci: '...', holder: 'Inquival ...' },
    // { bank: 'Interbank', currency: 'USD', accountNumber: '...', cci: '...', holder: 'Inquival ...' },
  ],
  yape: undefined,
  plin: undefined,
};
