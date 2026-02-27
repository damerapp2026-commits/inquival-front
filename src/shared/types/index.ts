export interface PaginatedResponse<T> { data: T[]; total: number; }
export interface ApiResponse<T> { data: T; message: string; }

export type ProductCategory = 'BIOESTIMULANTE' | 'HERBICIDA_AGRICOLA' | 'INSECTICIDA_AGRICOLA' | 'FUNGICIDA' | 'FOLIARES';
export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'BIOESTIMULANTE', label: 'Bioestimulante' },
  { value: 'HERBICIDA_AGRICOLA', label: 'Herbicida Agrícola' },
  { value: 'INSECTICIDA_AGRICOLA', label: 'Insecticida Agrícola' },
  { value: 'FUNGICIDA', label: 'Fungicida' },
  { value: 'FOLIARES', label: 'Foliares' },
];
export interface Product { id: string; name: string; description?: string; category: ProductCategory; unit: string; prices: ProductPrice[]; isActive: boolean; createdAt: string; }
export interface ProductPrice { priceTierId: string; price: number; }
export interface Company { id: string; name: string; ruc: string; address?: string; phone?: string; isActive: boolean; }
export interface PriceTier { id: string; name: string; description?: string; priority: number; isActive: boolean; }
export interface Stock { id: string; productId: string; companyId: string; quantity: number; lastUpdated: string; }
export interface Client { id: string; name: string; documentNumber?: string; phone?: string; email?: string; address?: string; isActive: boolean; }

export interface Sale { id: string; companyId?: string; clientId?: string; items: SaleItem[]; total: number; hasBoleta: boolean; paymentMethod: 'CASH' | 'CREDIT'; date: string; createdAt: string; }
export interface SaleItem { productId: string; companyId: string; quantity: number; priceTier: string; unitPrice: number; subtotal: number; }
export interface Purchase { id: string; companyId: string; supplier: string; items: PurchaseItem[]; totalCost: number; date: string; createdAt: string; }
export interface PurchaseItem { productId: string; quantity: number; unitCost: number; }
export interface User { id: string; email: string; fullName: string; role: string; }

export interface StockAdjustment { id: string; productId: string; companyId: string; type: 'INCREASE' | 'DECREASE'; quantity: number; reason: string; previousQuantity: number; newQuantity: number; adjustedBy?: string; date: string; createdAt: string; }

export interface CashRegisterEntry { id: string; type: 'INCOME' | 'EXPENSE'; category: 'SALE' | 'CREDIT_PAYMENT' | 'PURCHASE' | 'ADJUSTMENT' | 'OTHER'; description: string; amount: number; referenceId?: string; referenceType?: string; hasBoleta: boolean; isDeleted: boolean; deletedBy?: string; deletedAt?: string; deleteReason?: string; editHistory: { previousAmount: number; newAmount: number; reason: string; editedBy: string; editedAt: string }[]; createdBy?: string; }
export interface CashRegister { id: string; date: string; openingBalance: number; status: 'OPEN' | 'CLOSED'; entries: CashRegisterEntry[]; closingBalance?: number; closedBy?: string; closedAt?: string; notes?: string; createdBy?: string; }

export interface CreditPayment { id: string; amount: number; paymentDate: string; cashRegisterEntryId?: string; notes?: string; receivedBy?: string; }
export interface CreditAccount { id: string; clientId: string; saleId: string; totalAmount: number; paidAmount: number; pendingAmount: number; status: 'PENDING' | 'PARTIAL' | 'PAID'; payments: CreditPayment[]; createdBy?: string; createdAt: string; }
