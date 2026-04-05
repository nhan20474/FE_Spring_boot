import React, { useState, useRef, useEffect, useMemo } from 'react';

type FlattenedCategory = {
  id: number;
  name: string;
  depth: number;
};

interface SearchableCategorySelectProps {
  categories: FlattenedCategory[];
  value: string;
  onChange: (value: string) => void;
}

const SearchableCategorySelect: React.FC<SearchableCategorySelectProps> = ({ categories, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(query));
  }, [categories, searchQuery]);

  const selectedCategory = categories.find((c) => String(c.id) === String(value));

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border ${
          isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'
        } bg-white rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all`}
      >
        <span className={selectedCategory ? 'text-slate-900 font-semibold truncate' : 'text-slate-400'}>
          {selectedCategory ? selectedCategory.name : '-- Chọn danh mục --'}
        </span>
        <span className="material-icons text-slate-400 text-[20px] ml-2 shrink-0">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl overflow-hidden">
          {/* Search Input Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <span className="material-icons absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                autoFocus
                placeholder="Tìm danh mục..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Options List */}
          <ul className="max-h-60 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((cat) => {
                const isSelected = String(cat.id) === String(value);
                return (
                  <li
                    key={cat.id}
                    onClick={() => {
                      onChange(String(cat.id));
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`px-4 py-2 cursor-pointer text-sm transition-colors flex items-center ${
                      isSelected
                        ? 'bg-primary/5 text-primary'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span
                      className={`truncate ${isSelected ? 'font-bold' : 'font-medium'}`}
                    >
                      {cat.depth > 0 ? '\u00A0\u00A0\u00A0\u00A0'.repeat(cat.depth) + '↳ ' + cat.name : cat.name}
                    </span>
                    {isSelected && (
                      <span className="material-icons ml-auto text-[18px] text-primary">check</span>
                    )}
                  </li>
                );
              })
            ) : (
              <li className="px-4 py-6 text-center">
                <span className="material-icons text-slate-300 text-3xl mb-2">search_off</span>
                <p className="text-sm font-semibold text-slate-500">Không tìm thấy danh mục</p>
                <p className="text-xs text-slate-400 mt-0.5">Vui lòng thử từ khóa khác</p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableCategorySelect;
