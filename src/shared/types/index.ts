export interface PaginatedResponse<T> { data: T[]; total: number; }
export interface ApiResponse<T> { data: T; message: string; }

export interface Category { id: string; name: string; description?: string; isActive: boolean; }
export interface Product { id: string; name: string; description?: string; categoryId: string; unit: string; activeIngredient?: string; taxType?: string; prices: ProductPrice[]; tracksLot?: boolean; isActive: boolean; createdAt: string; }
export interface ProductPrice { priceTierId: string; companyId?: string; price: number; }
export interface Company { id: string; name: string; ruc: string; address?: string; phone?: string; isActive: boolean; }
export interface PriceTier { id: string; name: string; description?: string; priority: number; isActive: boolean; }
export interface Stock { id: string; productId: string; companyId: string; quantity: number; lastUpdated: string; }
export interface Client { id: string; name: string; documentNumber?: string; phone?: string; email?: string; address?: string; isActive: boolean; }

export interface PaymentMethod { id: string; name: string; isActive: boolean; }
export interface SalePayment { paymentMethodId: string; paymentMethodName: string; amount: number; }
export interface Sale { id: string; companyId?: string; clientId?: string; items: SaleItem[]; total: number; voucherType: string; isCredit: boolean; payments: SalePayment[]; isCancelled?: boolean; cancelledBy?: string; cancelledAt?: string; cancelReason?: string; date: string; createdAt: string; }
export interface SaleItem { productId: string; companyId: string; quantity: number; priceTier: string; unitPrice: number; subtotal: number; }
export interface Supplier { id: string; ruc: string; businessName: string; address?: string; phone?: string; isActive: boolean; }
export type PurchaseDocumentType = 'FACTURA' | 'BOLETA' | 'GUIA' | 'NOTA_CREDITO' | 'OTRO';
export interface Purchase { id: string; companyId: string; supplier: string; supplierId?: string; supplierRuc?: string; items: PurchaseItem[]; totalCost: number; totalCostUsd?: number; exchangeRate?: number; paymentType: 'CONTADO' | 'CREDITO'; paymentScheduleType?: 'SINGLE_DATE' | 'INSTALLMENTS'; dueDate?: string; date: string; createdAt: string; documentType?: PurchaseDocumentType; documentSeries?: string; documentNumber?: string; issueDate?: string; }
export interface PurchaseItem { productId: string; quantity: number; unitCost?: number; unitPriceSinIgv?: number; unitPriceConIgv?: number; flete?: number; otrosCostos?: number; precioVenta?: number; markupPercent?: number; lotNumber?: string; expirationDate?: string; }
export interface ProductLot { id: string; productId: string; companyId: string; lotNumber: string; expirationDate?: string; initialQuantity: number; currentQuantity: number; purchaseId?: string; receivedAt: string; isActive: boolean; }

export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
export interface QuoteItem { productId: string; companyId: string; quantity: number; priceTier: string; unitPrice: number; subtotal: number; }
export interface Quote { id: string; quoteNumber: string; series: string; number: number; companyId?: string; clientId?: string; clientName?: string; items: QuoteItem[]; total: number; notes?: string; status: QuoteStatus; issueDate: string; validUntil: string; convertedSaleId?: string; createdBy?: string; createdAt: string; }

export interface AccountPayableInstallment { id?: string; amount: number; dueDate: string; status: 'PENDING' | 'PAID'; paidDate?: string; }
export interface AccountPayablePayment { id?: string; amount: number; paymentDate: string; notes?: string; registeredBy?: string; registeredByName?: string; }
export interface AccountPayable { id: string; purchaseId: string; supplier: string; totalAmount: number; paidAmount: number; pendingAmount: number; status: 'PENDING' | 'PARTIAL' | 'PAID'; paymentScheduleType: 'SINGLE_DATE' | 'INSTALLMENTS'; dueDate?: string; installments: AccountPayableInstallment[]; payments: AccountPayablePayment[]; createdBy?: string; createdAt: string; }
export interface APAlerts { overdue: AccountPayable[]; upcoming: AccountPayable[]; summary: { totalPending: number; totalOverdue: number; count: number }; }
export interface User { id: string; username: string; email?: string; fullName: string; role: string; isActive?: boolean; createdAt?: string; updatedAt?: string; }

export interface StockAdjustment { id: string; productId: string; companyId: string; type: 'INCREASE' | 'DECREASE'; quantity: number; reason: string; previousQuantity: number; newQuantity: number; adjustedBy?: string; date: string; createdAt: string; }

export interface CashRegisterEntry { id: string; type: 'INCOME' | 'EXPENSE'; category: 'SALE' | 'CREDIT_PAYMENT' | 'PURCHASE' | 'ADJUSTMENT' | 'OTHER'; description: string; amount: number; referenceId?: string; referenceType?: string; voucherType: string; isDeleted: boolean; deletedBy?: string; deletedAt?: string; deleteReason?: string; editHistory: { previousAmount: number; newAmount: number; reason: string; editedBy: string; editedAt: string }[]; createdBy?: string; }
export interface CashRegister { id: string; date: string; openingBalance: number; status: 'OPEN' | 'CLOSED'; entries: CashRegisterEntry[]; closingBalance?: number; closedBy?: string; closedAt?: string; notes?: string; createdBy?: string; }

export interface CreditPayment { id: string; amount: number; paymentDate: string; paymentMethodId?: string; paymentMethodName?: string; cashRegisterEntryId?: string; notes?: string; receivedBy?: string; receivedByName?: string; }
export interface CreditSaleDetail { saleId: string; date: string; total: number; items: { productName: string; companyName: string; quantity: number; unitPrice: number; subtotal: number; }[]; }
export interface CreditAccount { id: string; clientId: string; name?: string; saleIds: string[]; saleDetails?: CreditSaleDetail[]; totalAmount: number; paidAmount: number; pendingAmount: number; status: 'PENDING' | 'PARTIAL' | 'PAID'; payments: CreditPayment[]; createdBy?: string; createdAt: string; }

export interface LoanItem { productId: string; companyId: string; quantity: number; returnedQuantity: number; }
export interface LoanReturnItem { productId: string; companyId: string; quantity: number; }
export interface LoanReturn { id?: string; items: LoanReturnItem[]; notes?: string; returnedBy?: string; date: string; }
export interface Loan { id: string; borrowerName: string; items: LoanItem[]; status: 'ACTIVE' | 'PARTIAL' | 'RETURNED'; returns: LoanReturn[]; notes?: string; date: string; createdBy?: string; createdAt: string; }
