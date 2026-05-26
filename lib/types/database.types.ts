export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: 'owner' | 'manager' | 'cashier'
          branch_id: string | null
          is_active: boolean
          created_at: string
          created_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      branches: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['branches']['Insert']>
      }
      product_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['product_categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['product_categories']['Insert']>
      }
      product_families: {
        Row: {
          id: string
          category_id: string
          name: string
          brand: string | null
          gender: 'men' | 'women' | 'kids' | 'unisex'
          description: string | null
          base_cost: number
          base_price: number
          currency: string
          is_active: boolean
          is_public: boolean
          public_image_path: string | null
          created_at: string
          created_by: string
        }
        Insert: Omit<Database['public']['Tables']['product_families']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['product_families']['Insert']>
      }
      product_variants: {
        Row: {
          id: string
          family_id: string
          sku: string
          barcode: string | null
          size: string
          color: string | null
          cost_price: number | null
          selling_price: number | null
          is_active: boolean
          low_stock_threshold: number
          created_at: string
          created_by: string
        }
        Insert: Omit<Database['public']['Tables']['product_variants']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['product_variants']['Insert']>
      }
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          status: 'active' | 'suspended' | 'trialing'
          plan_id: 'basic' | 'pro' | 'enterprise'
          paypal_payer_id: string | null
          paypal_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          status?: 'active' | 'suspended' | 'trialing'
          plan_id?: 'basic' | 'pro' | 'enterprise'
          paypal_payer_id?: string | null
          paypal_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      system_settings: {
        Row: {
          tenant_id: string
          key: string
          value: string
        }
        Insert: {
          tenant_id: string
          key: string
          value: string
        }
        Update: Partial<Database['public']['Tables']['system_settings']['Insert']>
      }
      expense_categories: {
        Row: {
          id: string
          tenant_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['expense_categories']['Insert']>
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
