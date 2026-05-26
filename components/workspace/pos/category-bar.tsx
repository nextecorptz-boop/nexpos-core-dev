import React from 'react'
import { LayoutGrid, CheckCircle2 } from 'lucide-react'

export interface Category {
  id: string
  name: string
  count: number
}

interface CategoryBarProps {
  categories: Category[]
  activeCategory: string
  onSelectCategory: (id: string) => void
}

const CATEGORY_STYLES: Record<string, { bg: string; iconBg: string; text: string }> = {
  All: { bg: 'bg-nx-surface', iconBg: 'bg-nx-elevated', text: 'text-nx-text-sec' },
  Running: { bg: 'bg-transparent', iconBg: 'bg-blue-50', text: 'text-blue-600' },
  Casual: { bg: 'bg-transparent', iconBg: 'bg-violet-50', text: 'text-violet-600' },
  Formal: { bg: 'bg-transparent', iconBg: 'bg-emerald-50', text: 'text-emerald-600' },
  Sport: { bg: 'bg-transparent', iconBg: 'bg-amber-50', text: 'text-amber-600' },
  Boots: { bg: 'bg-transparent', iconBg: 'bg-nx-gold/10', text: 'text-nx-gold' },
  Default: { bg: 'bg-transparent', iconBg: 'bg-nx-elevated', text: 'text-nx-text-sec' }
}

export function CategoryBar({ categories, activeCategory, onSelectCategory }: CategoryBarProps) {
  // Hardcoded for the UI prototype unless real categories exist, but we map to existing categories
  const allCategories = [{ id: 'all', name: 'All', count: categories.reduce((sum, c) => sum + c.count, 0) }, ...categories]

  return (
    <div className="w-full overflow-x-auto no-scrollbar touch-pan-x mb-4 pb-2 -mx-6 px-6 sm:mx-0 sm:px-0">
      <div className="flex items-center gap-3 w-max">
        {allCategories.map(cat => {
          const isActive = activeCategory === cat.id
          const style = CATEGORY_STYLES[cat.name] || CATEGORY_STYLES.Default
          
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex flex-col items-center justify-center min-w-[72px] h-[80px] rounded-nx-card transition-all duration-150 relative ${
                isActive
                  ? 'bg-nx-cyan/10 border-[1.5px] border-nx-cyan shadow-nx-md -translate-y-[1px]'
                  : 'bg-nx-surface border border-nx-border hover:border-nx-text-muted active:scale-[0.97]'
              }`}
            >
              <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center mb-1 ${style.iconBg}`}>
                <LayoutGrid className={`w-5 h-5 ${isActive ? 'text-nx-cyan' : style.text}`} />
              </div>
              <span className={`font-ui text-[11px] font-medium ${isActive ? 'text-nx-text font-bold' : 'text-nx-text-sec'}`}>
                {cat.name}
              </span>
              {/* Optional count if space allows, usually small badge */}
            </button>
          )
        })}
      </div>
    </div>
  )
}
