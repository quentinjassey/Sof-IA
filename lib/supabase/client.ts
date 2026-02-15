// lib/supabase/client.ts
// Browser-side Supabase client using public anon key
// Dependency: @supabase/supabase-js (npm install @supabase/supabase-js)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requises.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
