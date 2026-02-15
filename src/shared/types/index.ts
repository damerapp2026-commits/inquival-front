export interface PaginatedResponse<T> { data: T[]; total: number; }
export interface ApiResponse<T> { data: T; message: string; }

export interface Product { id: string; name: string; description?: string; category: string; unit: string; prices: ProductPrice[]; isActive: boolean; createdAt: string; }
export interface ProductPrice { priceTierId: string; price: number; }
export interface Company { id: string; name: string; ruc: string; address?: string; phone?: string; isActive: boolean; }
export interface PriceTier { id: string; name: string; description?: string; priority: number; isActive: boolean; }
export interface Stock { id: string; productId: string; companyId: string; quantity: number; lastUpdated: string; }
export interface Client { id: string; name: string; documentNumber?: string; phone?: string; email?: string; address?: string; isActive: boolean; }

export interface Sale { id: string; companyId: string; clientId?: string; items: SaleItem[]; total: number; date: string; createdAt: string; }
export interface SaleItem { productId: string; quantity: number; priceTier: string; unitPrice: number; subtotal: number; }
export interface Purchase { id: string; companyId: string; supplier: string; items: PurchaseItem[]; totalCost: number; date: string; createdAt: string; }
export interface PurchaseItem { productId: string; quantity: number; unitCost: number; }
export interface User { id: string; email: string; fullName: string; role: string; }
