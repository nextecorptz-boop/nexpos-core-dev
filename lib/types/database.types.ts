export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_families: {
        Row: {
          attributes: Json
          brand: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_families_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          color: string | null
          cost_price: number
          created_at: string
          family_id: string
          id: string
          is_active: boolean
          sell_price: number
          size: string | null
          sku: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          color?: string | null
          cost_price?: number
          created_at?: string
          family_id: string
          id: string
          is_active?: boolean
          sell_price: number
          size?: string | null
          sku: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          color?: string | null
          cost_price?: number
          created_at?: string
          family_id?: string
          id?: string
          is_active?: boolean
          sell_price?: number
          size?: string | null
          sku?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "product_families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          last_seen: string | null
          phone: string | null
          pin_hash: string | null
          role: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          last_seen?: string | null
          phone?: string | null
          pin_hash?: string | null
          role: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_seen?: string | null
          phone?: string | null
          pin_hash?: string | null
          role?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          last_refill: string
          tokens: number
        }
        Insert: {
          bucket_key: string
          last_refill?: string
          tokens?: number
        }
        Update: {
          bucket_key?: string
          last_refill?: string
          tokens?: number
        }
        Relationships: []
      }
      sale_lines: {
        Row: {
          id: string
          line_discount: number
          line_total: number
          quantity: number
          sale_id: string
          tenant_id: string
          unit_cost: number
          unit_price: number
          variant_id: string
        }
        Insert: {
          id: string
          line_discount?: number
          line_total: number
          quantity: number
          sale_id: string
          tenant_id: string
          unit_cost?: number
          unit_price: number
          variant_id: string
        }
        Update: {
          id?: string
          line_discount?: number
          line_total?: number
          quantity?: number
          sale_id?: string
          tenant_id?: string
          unit_cost?: number
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_lines_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          cashier_id: string
          client_id: string
          completed_at: string
          customer_id: string | null
          discount_amount: number
          id: string
          payment_meta: Json
          payment_method: string
          receipt_number: string
          status: string
          subtotal: number
          tenant_id: string
          total: number
          vat_amount: number
          voided_at: string | null
        }
        Insert: {
          branch_id: string
          cashier_id: string
          client_id: string
          completed_at?: string
          customer_id?: string | null
          discount_amount?: number
          id: string
          payment_meta?: Json
          payment_method: string
          receipt_number: string
          status?: string
          subtotal: number
          tenant_id: string
          total: number
          vat_amount: number
          voided_at?: string | null
        }
        Update: {
          branch_id?: string
          cashier_id?: string
          client_id?: string
          completed_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          payment_meta?: Json
          payment_method?: string
          receipt_number?: string
          status?: string
          subtotal?: number
          tenant_id?: string
          total?: number
          vat_amount?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          branch_id: string
          on_hand: number
          reorder_point: number
          tenant_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          branch_id: string
          on_hand?: number
          reorder_point?: number
          tenant_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          branch_id?: string
          on_hand?: number
          reorder_point?: number
          tenant_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          actor_id: string | null
          branch_id: string
          created_at: string
          delta: number
          id: string
          note: string | null
          reason: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          variant_id: string
        }
        Insert: {
          actor_id?: string | null
          branch_id: string
          created_at?: string
          delta: number
          id: string
          note?: string | null
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          variant_id: string
        }
        Update: {
          actor_id?: string | null
          branch_id?: string
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          country_code: string
          created_at: string
          currency_code: string
          id: string
          name: string
          plan_id: string
          slug: string
          status: string
          timezone: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          country_code?: string
          created_at?: string
          currency_code?: string
          id: string
          name: string
          plan_id?: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          country_code?: string
          created_at?: string
          currency_code?: string
          id?: string
          name?: string
          plan_id?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
    }
    Views: {
      current_stock: {
        Row: {
          branch_code: string | null
          branch_id: string | null
          branch_name: string | null
          category: string | null
          color: string | null
          on_hand: number | null
          product_brand: string | null
          product_name: string | null
          reorder_point: number | null
          sell_price: number | null
          size: string | null
          sku: string | null
          tenant_id: string | null
          updated_at: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_branch_id: unknown
          p_delta: number
          p_movement_id?: unknown
          p_note?: string
          p_reason: string
          p_variant_id: unknown
        }
        Returns: Json
      }
      complete_sale: { Args: { p_input: Json }; Returns: Json }
      current_branch: { Args: never; Returns: unknown }
      current_role: { Args: never; Returns: string }
      current_tenant: { Args: never; Returns: unknown }
      current_user_id: { Args: never; Returns: string }
      f_unaccent: { Args: { "": string }; Returns: string }
      generate_ulid: { Args: never; Returns: unknown }
      has_role: { Args: { allowed_roles: string[] }; Returns: boolean }
      write_audit_log: {
        Args: {
          p_action: string
          p_actor_id: string
          p_entity_id?: string
          p_entity_type: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_tenant_id: unknown
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
