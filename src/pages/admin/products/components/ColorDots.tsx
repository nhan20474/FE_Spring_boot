import React from 'react';

export type ColorDotItem = { hex: string; name?: string };

type ColorDotsProps = {
  items: ColorDotItem[];
};

function titleForDot(item: ColorDotItem): string {
  const n = item.name?.trim();
  if (n) return n;
  return item.hex;
}

const ColorDots: React.FC<ColorDotsProps> = ({ items }) => (
  <div className="flex flex-wrap items-center gap-1">
    {items.map((item, i) => {
      const label = item.name?.trim() || item.hex;
      return (
        <span
          key={`${label}-${i}`}
          className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 max-w-[140px] truncate"
          title={titleForDot(item)}
        >
          {label}
        </span>
      );
    })}
  </div>
);

export default ColorDots;
