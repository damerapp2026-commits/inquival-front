import { Wrench, Briefcase, Boxes, Home, Truck, MoreHorizontal, ShoppingCart as CartIcon, Sliders } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ExpenseCategoryKey =
  | 'SERVICES'
  | 'SALARY'
  | 'SUPPLIES'
  | 'RENT'
  | 'TRANSPORT'
  | 'PURCHASE'
  | 'ADJUSTMENT'
  | 'OTHER';

export interface ExpenseCategoryDef {
  key: ExpenseCategoryKey;
  label: string;
  icon: LucideIcon;
  badge: string;
  tile: string;
  pickable: boolean;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  { key: 'SERVICES',   label: 'Servicios',  icon: Wrench,         badge: 'bg-cyan-50 text-cyan-700 border-cyan-100',       tile: 'bg-cyan-100 text-cyan-700',        pickable: true },
  { key: 'SALARY',     label: 'Sueldos',    icon: Briefcase,      badge: 'bg-violet-50 text-violet-700 border-violet-100', tile: 'bg-violet-100 text-violet-700',    pickable: true },
  { key: 'SUPPLIES',   label: 'Insumos',    icon: Boxes,          badge: 'bg-amber-50 text-amber-700 border-amber-100',    tile: 'bg-amber-100 text-amber-700',      pickable: true },
  { key: 'RENT',       label: 'Alquiler',   icon: Home,           badge: 'bg-orange-50 text-orange-700 border-orange-100', tile: 'bg-orange-100 text-orange-700',    pickable: true },
  { key: 'TRANSPORT',  label: 'Transporte', icon: Truck,          badge: 'bg-teal-50 text-teal-700 border-teal-100',       tile: 'bg-teal-100 text-teal-700',        pickable: true },
  { key: 'PURCHASE',   label: 'Compra',     icon: CartIcon,       badge: 'bg-rose-50 text-rose-700 border-rose-100',       tile: 'bg-rose-100 text-rose-700',        pickable: false },
  { key: 'ADJUSTMENT', label: 'Ajuste',     icon: Sliders,        badge: 'bg-blue-50 text-blue-700 border-blue-100',       tile: 'bg-blue-100 text-blue-700',        pickable: false },
  { key: 'OTHER',      label: 'Otros',      icon: MoreHorizontal, badge: 'bg-gray-100 text-gray-600 border-gray-200',      tile: 'bg-gray-100 text-gray-600',        pickable: true },
];

export const EXPENSE_CATEGORY_BY_KEY: Record<string, ExpenseCategoryDef> =
  EXPENSE_CATEGORIES.reduce((map, c) => { map[c.key] = c; return map; }, {} as Record<string, ExpenseCategoryDef>);

export function getExpenseCategoryDef(key: string): ExpenseCategoryDef {
  return EXPENSE_CATEGORY_BY_KEY[key] || EXPENSE_CATEGORY_BY_KEY.OTHER;
}
