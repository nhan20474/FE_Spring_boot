import type { CartItem } from '@/types';

/** Dòng hàng gửi quote/đặt hàng — chỉ productId, quantity và biến thể; giá do server tính. */
export function toCheckoutLineItems(items: CartItem[]): Array<{
  productId: number;
  quantity: number;
  selectedColor?: string;
  selectedStorage?: string;
}> {
  return items.map((i) => {
    const productId = Number(i.productId);
    const quantity = Number(i.quantity);
    const color =
      i.selectedColor != null && String(i.selectedColor).trim() !== ''
        ? String(i.selectedColor).trim()
        : undefined;
    const storage =
      i.selectedStorage != null && String(i.selectedStorage).trim() !== ''
        ? String(i.selectedStorage).trim()
        : undefined;
    return {
      productId,
      quantity,
      ...(color ? { selectedColor: color } : {}),
      ...(storage ? { selectedStorage: storage } : {}),
    };
  });
}

/** Chuỗi ổn định theo nội dung giỏ (không dùng giá client) để trigger quote. */
export function cartItemsQuoteSignature(items: CartItem[]): string {
  return JSON.stringify(
    items.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      selectedColor: i.selectedColor ?? null,
      selectedStorage: i.selectedStorage ?? null,
    })),
  );
}
