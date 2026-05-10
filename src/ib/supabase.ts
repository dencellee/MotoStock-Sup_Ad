// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

// ✅ Add these logs temporarily to debug
console.log('[Supabase] URL:', PUBLIC_SUPABASE_URL)
console.log('[Supabase] Key set:', !!PUBLIC_SUPABASE_ANON_KEY)

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)