/** Đồng bộ với backend ShippingPricing: ≥500k hàng (sau giảm) miễn phí, không thì 30k. */
export const FREE_SHIPPING_THRESHOLD_VND = 500_000;
export const FLAT_SHIPPING_VND = 30_000;

export function shippingCostForNetMerchandiseVnd(netAfterDiscount: number): number {
  const n = Math.max(0, Number(netAfterDiscount) || 0);
  return n >= FREE_SHIPPING_THRESHOLD_VND ? 0 : FLAT_SHIPPING_VND;
}
