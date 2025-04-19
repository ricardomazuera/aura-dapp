import { createClient } from '@supabase/supabase-js';

// Valores por defecto para desarrollo local si las variables de entorno no están definidas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Verificar si estamos en el navegador y si las variables están configuradas
if (typeof window !== 'undefined') {
  console.log('Supabase URL:', supabaseUrl);
  if (supabaseUrl === 'https://your-project.supabase.co') {
    console.warn('⚠️ Supabase URL no configurada correctamente. Por favor verifica tu archivo .env.local');
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