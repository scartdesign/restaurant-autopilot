import { createClient } from '@supabase/supabase-js'

// Publishable project credentials are safe for browser use; RLS protects tenant data.
// Environment variables override these values for staging/production deployments.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pkbsveezmjkvfuiplrqb.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_8fi3ux6Ofenth8vzpesGHQ_HMkraM5P'

export const supabase = createClient(supabaseUrl, supabaseKey)
