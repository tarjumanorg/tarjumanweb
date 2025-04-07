// src/utils/supabaseUtils.ts
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Handles common Supabase Postgrest errors, logs them, and throws standardized Error objects.
 *
 * @param error - The PostgrestError object returned from a Supabase query, or null/undefined if no error occurred.
 * @param context - A string describing the operation context (e.g., "fetch guestbook entries", "create order") for clearer error messages.
 * @throws {Error} Throws a standardized error ('Permission Denied', 'Database Error') if the input `error` is not null/undefined.
 */
export function handleSupabaseError(error: PostgrestError | null | undefined, context: string): void {
  if (!error) {
    // No error occurred, do nothing.
    return;
  }

  // Log the original error for debugging purposes
  console.error(`Service Error (${context}):`, error);

  // Handle specific, known error codes
  if (error.code === '42501') { // RLS violation
    throw new Error(`Permission Denied: Cannot ${context}. Check RLS policies.`);
  }

  // Handle other database-related errors generically
  // Add more specific error code checks here if needed in the future
  // e.g., if (error.code === '23505') { throw new Error(`Database Error: Unique constraint violation during ${context}.`); }

  // Fallback for any other database error
  throw new Error(`Database Error: Failed to ${context}: ${error.message}`);
}