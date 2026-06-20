import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // No bloquea el build; advierte en consola durante el desarrollo.
  console.warn('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el entorno.')
}

export const supabase = createClient(url ?? '', anonKey ?? '')
