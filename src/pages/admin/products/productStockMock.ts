/**
 * Kiểu và tiện ích trang tồn kho — dữ liệu sản phẩm lấy từ API admin.
 */

export type StockProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  piece: number;
  /** Mã hex (#rrggbb) cho chấm màu */
  colors: string[];
  /** URL ảnh hoặc data URL */
  image: string;
};

export const STOCK_CATEGORY_OPTIONS = [
  'Digital Product',
  'Fashion',
  'Mobile',
  'Electronic',
] as const;

/** Preset cho form multi-select (value = hex) */
export const STOCK_COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: '#111827', label: 'Black' },
  { hex: '#9CA3AF', label: 'Gray' },
  { hex: '#EC4899', label: 'Pink' },
  { hex: '#EF4444', label: 'Red' },
  { hex: '#3B82F6', label: 'Blue' },
  { hex: '#F59E0B', label: 'Yellow' },
  { hex: '#10B981', label: 'Green' },
  { hex: '#F97316', label: 'Orange' },
];

