import type { PostgrestError } from '@supabase/supabase-js';

export function handleSupabaseError(error: PostgrestError | null | undefined, context: string): void {
  if (!error) {

    return;
  }

  console.error(`Service Error (${context}):`, error);

  if (error.code === '42501') { 
    throw new Error(`Permission Denied: Cannot ${context}. Check RLS policies.`);
  }

  throw new Error(`Database Error: Failed to ${context}: ${error.message}`);
}