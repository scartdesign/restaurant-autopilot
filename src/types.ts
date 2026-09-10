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
