/** Mostrar y devolver el total del producto aunque su stock esté distribuido. */
export function groupLoanItems(items: readonly { productId: string; quantity: number; returnedQuantity?: number }[]) {
  const products = new Map<string, { productId: string; quantity: number; returnedQuantity: number }>();
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  for (const item of items) {
    const row = products.get(item.productId) || { productId: item.productId, quantity: 0, returnedQuantity: 0 };
    row.quantity = round(row.quantity + item.quantity);
    row.returnedQuantity = round(row.returnedQuantity + (item.returnedQuantity || 0));
    products.set(item.productId, row);
  }
  return [...products.values()];
}
