import React from 'react';

export type ColorDotItem = { hex: string; name?: string };

type ColorDotsProps = {
  items: ColorDotItem[];
};

function titleForDot(item: ColorDotItem): string {
  const n = item.name?.trim();
  if (n) return `${n} (${item.hex})`;
  return item.hex;
}

const ColorDots: React.FC<ColorDotsProps> = ({ items }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {items.map((item, i) => (
      <span
        key={`${item.hex}-${i}`}
        className="w-4 h-4 rounded-full border border-slate-200 shrink-0"
        style={{ backgroundColor: item.hex }}
        title={titleForDot(item)}
      />
    ))}
  </div>
);

export default ColorDots;
