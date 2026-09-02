import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const supabase = supabaseConfigured
	? createClient(supabaseUrl, supabaseKey, {
			auth: { persistSession: false, autoRefreshToken: false },
		})
	: null