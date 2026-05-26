import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Store } from 'lucide-react'
import CatalogView from '@/components/public/catalog-view'
import { Metadata } from 'next'

interface Props {
  params: {
    slug: string
  }
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = (await createServiceClient()) as any
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, status')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!tenant || tenant.status === 'suspended') {
    return {
      title: 'Catalog Unavailable | NEXPOS',
      description: 'The requested catalog is currently unavailable.'
    }
  }

  return {
    title: `${tenant.name} - Online Catalog`,
    description: `Browse our curated collection of footwear at ${tenant.name}. Find premium shoes, sandals, boots, and sneakers.`,
  }
}

export default async function TenantCatalogPage({ params }: Props) {
  const supabase = (await createServiceClient()) as any

  // 1. Fetch Tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()

  // If tenant does not exist, return 404
  if (!tenant) {
    notFound()
  }

  // If tenant is suspended, show a premium subscription suspended barrier page
  if (tenant.status === 'suspended') {
    return (
      <div className="min-h-screen bg-[#0E0D0B] flex items-center justify-center px-6 py-12 text-center">
        <div className="max-w-md w-full glass-card p-8 border border-destructive/20">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-6">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-[#FAF6EE] mb-3">
            Catalog Unavailable
          </h1>
          <p className="text-[#A19B94] text-sm mb-6 leading-relaxed">
            The catalog for <span className="text-[#FAF6EE] font-semibold">{tenant.name}</span> is temporarily offline due to an inactive workspace subscription.
          </p>
          <Link
            href="/"
            className="btn-primary inline-flex items-center gap-2 px-6 py-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Homepage
          </Link>
        </div>
      </div>
    )
  }

  // 2. Fetch Categories for this tenant
  const { data: categories } = await supabase
    .from('product_categories')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('name')

  // 3. Fetch Public, Active Products for this tenant
  const { data: products } = await supabase
    .from('product_families')
    .select('*, category:product_categories(name)')
    .eq('tenant_id', tenant.id)
    .eq('is_public', true)
    .eq('is_active', true)
    .order('name')

  const formattedProducts = (products || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    gender: p.gender,
    description: p.description,
    base_price: Number(p.base_price),
    currency: p.currency || 'TZS',
    public_image_path: p.public_image_path,
    category: p.category
  }))

  const formattedCategories = (categories || []).map((c: any) => ({
    id: c.id,
    name: c.name
  }))

  return (
    <div className="min-h-screen bg-[#0E0D0B] flex flex-col justify-between">
      {/* Navigation */}
      <header>
        <nav className="fixed top-0 w-full z-50 bg-[#0E0D0B]/80 backdrop-blur-md border-b border-[#292521]">
          <div className="container mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <Link href="/" className="font-display text-2xl font-bold text-[#FAF6EE] tracking-wide flex items-center gap-2">
                <Store className="w-5 h-5 text-[#B48E4F]" />
                <span>{tenant.name}</span>
              </Link>
              
              <div className="flex items-center space-x-8">
                <Link href="/" className="font-label text-xs tracking-wider text-[#A19B94] hover:text-[#FAF6EE] transition-colors uppercase">
                  Home
                </Link>
                <Link href="/login" className="font-label text-xs tracking-wider text-[#B48E4F] hover:text-[#B48E4F]/80 transition-colors uppercase">
                  Staff Login
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-grow pt-32 pb-20">
        <div className="container mx-auto px-6 lg:px-8">
          {/* Header section */}
          <div className="mb-12">
            <Link href="/" className="inline-flex items-center gap-2 text-[#A19B94] hover:text-[#FAF6EE] transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-label uppercase text-xs tracking-wider">Back to Home</span>
            </Link>
            <h1 className="font-display text-5xl lg:text-6xl font-bold text-[#FAF6EE] mb-4">
              Our Collection
            </h1>
            <p className="font-body text-base text-[#A19B94] max-w-xl leading-relaxed">
              Explore the exclusive retail collection of footwear curated by {tenant.name}.
            </p>
          </div>

          {/* Interactive Catalog Component */}
          <CatalogView
            tenantName={tenant.name}
            products={formattedProducts}
            categories={formattedCategories}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2D2823] bg-[#0A0908] py-12">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="font-display text-xl font-bold text-[#FAF6EE] flex items-center gap-2">
              <Store className="w-4 h-4 text-[#B48E4F]" />
              <span>{tenant.name}</span>
            </div>
            <p className="text-[#A19B94] text-xs">
              © {new Date().getFullYear()} {tenant.name}. Powered by NEXPOS SaaS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
