/**
 * Kiểu và tiện ích trang tồn kho — dữ liệu sản phẩm lấy từ API admin.
 */

/** Một màu hiển thị (theo JSON `colors` từ backend / form modal). */
export type StockColorDot = {
  hex: string;
  /** Tên màu từ API, dùng cho tooltip */
  name?: string;
};

export type StockProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  piece: number;
  /** Theo `ProductDto.colors` sau khi parse; rỗng khi không cấu hình */
  colorDots: StockColorDot[];
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

