// lib/supabase/server.ts
// Server-side Supabase client using service role key
// For use in API routes ONLY — never expose to browser
// Dependency: @supabase/supabase-js (npm install @supabase/supabase-js)

import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a server-side Supabase client with service role privileges.
 * This client bypasses RLS and has full access to all data.
 * Must ONLY be used in API routes (server-side).
 * All queries should be filtered by license_id from the session cookie.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Les variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises pour le client serveur.'
    )
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
