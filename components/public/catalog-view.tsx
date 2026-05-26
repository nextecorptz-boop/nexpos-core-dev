'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, ArrowUpDown, Tag, Sparkles } from 'lucide-react'

interface Product {
  id: string
  name: string
  brand: string | null
  gender: string | null
  description: string | null
  base_price: number
  currency: string
  public_image_path: string | null
  category: {
    name: string
  } | null
}

interface Category {
  id: string
  name: string
}

interface CatalogViewProps {
  tenantName: string
  products: Product[]
  categories: Category[]
}

export default function CatalogView({ tenantName, products, categories }: CatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc'>('name')
  const [genderFilter, setGenderFilter] = useState<string>('all')

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products]

    // Search query filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.brand && p.brand.toLowerCase().includes(query)) ||
          (p.description && p.description.toLowerCase().includes(query))
      )
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category?.name === selectedCategory)
    }

    // Gender filter
    if (genderFilter !== 'all') {
      result = result.filter((p) => p.gender === genderFilter)
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else if (sortBy === 'price-asc') {
        return a.base_price - b.base_price
      } else if (sortBy === 'price-desc') {
        return b.base_price - a.base_price
      }
      return 0
    })

    return result
  }, [products, searchQuery, selectedCategory, sortBy, genderFilter])

  return (
    <div className="w-full">
      {/* Search and Filters Section */}
      <div className="glass-card p-6 md:p-8 mb-12 space-y-6">
        <div className="grid md:grid-cols-12 gap-4">
          {/* Search bar */}
          <div className="md:col-span-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-sec" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-nx-surface border border-nx-border text-nx-text pl-11 pr-4 py-3 focus:outline-none focus:border-nx-cyan transition-colors rounded-nx-btn"
              placeholder="Search products, brands, or collections..."
            />
          </div>

          {/* Gender selection */}
          <div className="md:col-span-3 relative">
            <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-sec" />
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full bg-nx-surface border border-nx-border text-nx-text pl-11 pr-4 py-3 appearance-none focus:outline-none focus:border-nx-cyan transition-colors rounded-nx-btn"
            >
              <option value="all">All Genders</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="kids">Kids</option>
              <option value="unisex">Unisex</option>
            </select>
          </div>

          {/* Sorting selection */}
          <div className="md:col-span-3 relative">
            <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-sec" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-nx-surface border border-nx-border text-nx-text pl-11 pr-4 py-3 appearance-none focus:outline-none focus:border-nx-cyan transition-colors rounded-nx-btn"
            >
              <option value="name">Sort by Name</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="border-t border-nx-border pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-3.5 h-3.5 text-nx-cyan" />
            <span className="font-label uppercase text-[10px] tracking-wider text-nx-text-sec">
              Filter by Category
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 text-xs font-label uppercase tracking-wider rounded-full transition-all duration-200 border ${
                selectedCategory === 'all'
                  ? 'bg-nx-cyan text-white border-nx-cyan font-medium'
                  : 'bg-nx-surface border-nx-border text-nx-text-sec hover:text-nx-text hover:border-nx-text-sec'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-1.5 text-xs font-label uppercase tracking-wider rounded-full transition-all duration-200 border ${
                  selectedCategory === cat.name
                    ? 'bg-nx-cyan text-white border-nx-cyan font-medium'
                    : 'bg-nx-surface border-nx-border text-nx-text-sec hover:text-nx-text hover:border-nx-text-sec'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Counter */}
      <div className="flex items-center justify-between mb-8">
        <p className="text-sm text-nx-text-sec">
          Showing <span className="text-nx-text font-semibold">{filteredAndSortedProducts.length}</span> products
        </p>
      </div>

      {/* Products Grid */}
      {filteredAndSortedProducts.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredAndSortedProducts.map((product) => (
            <div
              key={product.id}
              className="glass-card overflow-hidden group hover:border-nx-cyan/50 hover:shadow-md transition-all duration-300 flex flex-col h-full"
            >
              {/* Product Image */}
              <div className="bg-nx-elevated h-72 w-full relative overflow-hidden flex items-center justify-center border-b border-nx-border">
                {product.public_image_path ? (
                  <img
                    src={product.public_image_path}
                    alt={product.name}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 bg-nx-elevated flex flex-col items-center justify-center p-4">
                    <Sparkles className="w-10 h-10 text-nx-text-muted/20 mb-3 group-hover:text-nx-cyan/40 transition-colors duration-300" />
                    <span className="text-nx-text-sec text-xs font-label uppercase tracking-widest text-center max-w-[200px]">
                      {product.brand || tenantName}
                    </span>
                  </div>
                )}

                {/* Gender Badge */}
                {product.gender && (
                  <span className="absolute top-4 right-4 bg-nx-surface/90 backdrop-blur-sm border border-nx-border text-nx-text rounded-full px-3 py-1 text-[10px] font-label uppercase tracking-widest shadow-sm">
                    {product.gender}
                  </span>
                )}
              </div>

              {/* Product Info */}
              <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-nx-cyan font-label uppercase text-[10px] tracking-widest">
                      {product.category?.name || 'Footwear'}
                    </p>
                    {product.brand && (
                      <p className="text-nx-text-sec text-[10px] font-semibold uppercase tracking-wider">
                        {product.brand}
                      </p>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold text-nx-text line-clamp-1 group-hover:text-nx-cyan transition-colors duration-200">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-nx-text-sec text-xs font-body line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-nx-border flex items-center justify-between">
                  <span className="text-nx-text font-data text-lg font-bold">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: product.currency || 'TZS',
                      minimumFractionDigits: 0,
                    })
                      .format(product.base_price)
                      .replace('TZS', 'TZS ')}
                  </span>
                  <span className="text-[10px] font-label uppercase tracking-wider text-nx-text-sec group-hover:text-nx-cyan transition-colors duration-300">
                    View Details →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-16 text-center">
          <p className="font-body text-lg text-nx-text-sec">
            No products match your search or filters. Try adjusting them!
          </p>
        </div>
      )}
    </div>
  )
}
