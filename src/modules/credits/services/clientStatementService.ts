import type { CreditAccount, Sale } from '../../../shared/types';
import { creditService } from './creditService';
import { saleService } from '../../sales/services/saleService';
import { collectStatementPages } from '../utils/statementPagination';

export const getStatementCredits = (clientId: string): Promise<CreditAccount[]> =>
  collectStatementPages<CreditAccount>((page, limit) => creditService.getByClient(clientId, { page, limit }));

export const getStatementSales = (clientId: string): Promise<Sale[]> =>
  collectStatementPages<Sale>((page, limit) => saleService.getAll({ clientId, page, limit, excludeCancelled: 'true' }));
