export type LogoPosition = 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right'
export type LogoSize = 's' | 'm' | 'l'
export type LogoBadge = 'none' | 'white' | 'dark' | 'blur'

export type Restaurant = {
  id: string
  owner_id: string
  name: string
  city: string | null
  neighborhood: string | null
  country: string
  phone: string | null
  website: string | null
  instagram: string | null
  facebook: string | null
  cuisine_type: string | null
  brand_style: 'modern' | 'premium' | 'traditional' | 'fast_food' | 'casual'
  primary_color: string | null
  secondary_color: string | null
  logo_url: string | null
  description: string | null
  target_audience: string | null
  social_goal: 'reservations' | 'walk_ins' | 'delivery' | 'awareness'
  hashtag_mode: 'smart' | 'local' | 'balanced' | 'minimal'
  language: string
  tone: 'friendly' | 'premium' | 'playful' | 'traditional' | 'direct'
  posting_frequency: number
  reservation_url: string | null
  onboarding_completed: boolean
  default_logo_visible?: boolean
  default_logo_position?: LogoPosition
  default_logo_size?: LogoSize
  default_logo_badge?: LogoBadge
  default_overlay_strength?: number
}

export type MenuItem = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  category: string | null
  price: number | null
  currency: string
  image_url: string | null
  is_active: boolean
}

export type PlatformPostContent = {
  caption?: string
  hashtags?: string[]
  keywords?: string[]
  strategy?: string
  alt_text?: string
}

export type VisualDesignMeta = {
  template?: 'editorial' | 'bold' | 'minimal' | 'split' | 'poster' | 'luxe'
  format?: 'feed' | 'story'
  headline?: string
  subline?: string
  cta?: string
  image_url?: string | null
  photo_position?: 'left' | 'center' | 'right'
  overlay?: number
  primary_color?: string
  accent_color?: string
  logo_visible?: boolean
  logo_position?: LogoPosition
  logo_size?: LogoSize
  logo_badge?: LogoBadge
  saved_at?: string
}

export type GenerationMeta = Record<string, unknown> & {
  image_url?: string | null
  engine?: string
  pillar?: string
  variation?: number
  format?: string
  visual_design?: VisualDesignMeta
}

export type Post = {
  id: string
  restaurant_id: string
  content_plan_id: string | null
  menu_item_id: string | null
  promotion_id: string | null
  post_type: 'feed' | 'story' | 'promotion'
  scheduled_for: string | null
  title: string | null
  caption: string | null
  cta: string | null
  hashtags: string[]
  visual_brief: string | null
  status: 'draft' | 'approved' | 'rejected' | 'published'
  generation_meta: GenerationMeta
  platform_content: {
    instagram?: PlatformPostContent
    facebook?: PlatformPostContent
  }
  discovery_score: number
  seo_keywords: string[]
}

export type SalesPlan = {
  id: string
  code: string
  name: string
  description: string | null
  billing_interval: 'monthly' | 'yearly' | 'lifetime' | 'custom'
  price: number
  currency: string
  trial_days: number
  max_restaurants: number
  monthly_generation_limit: number
  features: Record<string, unknown>
  active: boolean
  public: boolean
  sort_order: number
}

export type CustomerSubscription = {
  id: string
  user_id: string
  plan_id: string | null
  status: 'pending' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'suspended'
  starts_at: string
  expires_at: string | null
  auto_renew: boolean
  payment_method: string | null
  external_reference: string | null
  custom_generation_limit: number | null
  notes: string | null
  created_at: string
  updated_at?: string
  sales_plans?: SalesPlan | null
}

export type SalesOrder = {
  id: string
  order_number: string
  user_id: string
  plan_id: string | null
  subscription_id: string | null
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  payment_method: 'bank_transfer' | 'paypal' | 'card' | 'cash' | 'manual' | 'invoice' | 'license_code'
  amount: number
  currency: string
  customer_note: string | null
  admin_note: string | null
  paid_at: string | null
  due_at?: string | null
  payment_reference?: string | null
  billing_snapshot?: Record<string, unknown>
  created_at: string
  sales_plans?: SalesPlan | null
}

export type CustomerProfile = {
  user_id: string
  email: string
  full_name: string | null
  phone: string | null
  company: string | null
  billing_company?: string | null
  billing_tax_id?: string | null
  billing_company_number?: string | null
  billing_address?: string | null
  billing_city?: string | null
  billing_country?: string | null
  trial_claimed_at: string | null
  created_at: string
  updated_at?: string
}

export type SalesSettings = {
  id: number
  company_name: string
  sales_email: string | null
  support_email: string | null
  bank_instructions: string | null
  paypal_url: string | null
  terms_url: string | null
  allow_bank_transfer: boolean
  allow_paypal: boolean
  allow_card: boolean
  allow_invoice: boolean
  trial_enabled: boolean
  legal_name?: string | null
  tax_id?: string | null
  company_number?: string | null
  address?: string | null
  bank_name?: string | null
  bank_account?: string | null
  payment_model?: string | null
  invoice_note?: string | null
  order_due_days?: number
  renewal_notice_days?: number
}

export type LicenseCodeRow = {
  id: string
  code_last4: string
  plan_id: string
  duration_days: number | null
  assigned_email: string | null
  max_uses: number
  use_count: number
  status: 'active' | 'depleted' | 'revoked'
  expires_at: string | null
  sale_amount: number | null
  currency: string
  payment_method: string
  note: string | null
  created_at: string
  sales_plans?: SalesPlan | null
}

export type Entitlement = {
  active: boolean
  is_superadmin?: boolean
  subscription_id?: string
  status?: string
  starts_at?: string
  expires_at?: string | null
  plan_id?: string
  plan_code?: string
  plan_name?: string
  billing_interval?: string
  generation_limit?: number | null
  generated_this_month?: number
  restaurants_limit?: number | null
  restaurants_used?: number
  features?: Record<string, unknown>
}

export type NotificationOutbox = {
  id: number
  user_id: string | null
  recipient_email: string | null
  kind: 'order_created' | 'order_paid' | 'trial_started' | 'license_activated' | 'subscription_expiring' | 'subscription_expired' | 'admin_note'
  subject: string
  body: string
  payload: Record<string, unknown>
  delivery_status: 'queued' | 'sent' | 'failed' | 'dismissed'
  visible_in_app: boolean
  read_at: string | null
  sent_at: string | null
  created_at: string
}

export type AdminAuditLog = {
  id: number
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}
