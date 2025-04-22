import { createClient } from '@supabase/supabase-js';

// Default values for local development if environment variables are not defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Verify if we are in the browser and if the variables are configured
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl);
  if (supabaseUrl === 'https://your-project.supabase.co') {
    console.warn('⚠️ Supabase URL not configured correctly. Please check your .env.local file');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});