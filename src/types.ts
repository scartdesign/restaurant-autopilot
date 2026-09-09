export type Restaurant = {
  id: string
  owner_id: string
  name: string
  city: string | null
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
  language: string
  tone: 'friendly' | 'premium' | 'playful' | 'traditional' | 'direct'
  posting_frequency: number
  reservation_url: string | null
  onboarding_completed: boolean
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
  generation_meta: Record<string, unknown>
}
