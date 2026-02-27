"use client";

import { CATEGORIES, type Category } from "@/lib/constants";

interface FilterBarProps {
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
}

export function FilterBar({ activeCategory, onCategoryChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onCategoryChange(cat.value)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeCategory === cat.value
              ? "bg-emerald-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          <span>{cat.icon}</span>
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  );
}
