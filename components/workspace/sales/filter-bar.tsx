'use client'

import React from 'react'
import { Search, Calendar, Filter } from 'lucide-react'

interface Category {
  id: string
  name: string
}

interface FilterBarProps {
  searchQuery: string
  onSearchChange: (val: string) => void
  categories: Category[]
  selectedCategory: string
  onCategoryChange: (id: string) => void
  timeRange?: string
  onTimeRangeChange?: (range: string) => void
  placeholder?: string
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  timeRange,
  onTimeRangeChange,
  placeholder = 'Search...'
}: FilterBarProps) {
  return (
    <div className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 select-none">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] md:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] pl-9 pr-4 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors"
        />
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category Selector */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-nx-text-muted" />
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors min-w-[130px]"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Selector */}
        {timeRange && onTimeRangeChange && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-nx-text-muted" />
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors min-w-[130px]"
            >
              <option value="today">Today</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="12m">12 Months</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
