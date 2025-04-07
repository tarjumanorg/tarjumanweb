// src/services/guestbook.service.ts
import { supabase } from '../lib/supabase'; // Import the initialized client
import type { GuestbookEntry } from '../types/types'; // Use our defined type
import { handleSupabaseError } from '../utils/supabaseUtils'; // <-- IMPORT ADDED

/**
 * Fetches all guestbook entries, ordered by creation date (ascending).
 * Throws an error if the Supabase query fails.
 */
export async function getAllGuestbookEntries(): Promise<GuestbookEntry[]> {
  const operationContext = "fetch guestbook entries";
  console.log(`Service: ${operationContext}...`);

  const { data, error } = await supabase
    .from("guestbook")
    .select("name, message") // Select only needed fields defined in the type
    .order("created_at", { ascending: true }); // Or false based on desired display order

  // Use the utility function to handle potential errors
  handleSupabaseError(error, operationContext); // <-- REPLACED if(error) block

  // If handleSupabaseError didn't throw, the operation was successful (though data might be empty)
  console.log("Service: Fetched entries successfully.");
  return data as GuestbookEntry[];
}

/**
 * Creates a new guestbook entry.
 * Throws an error if validation fails or the Supabase insert operation fails.
 * @param name - The name of the poster.
 * @param message - The message content.
 * @returns The newly created guestbook entry (only name and message).
 */
export async function createGuestbookEntry(name: string, message: string): Promise<GuestbookEntry> {
  // Basic validation within the service (remains unchanged)
  if (!name || !message || name.trim().length === 0 || message.trim().length === 0) {
      throw new Error("Validation Error: Name and message cannot be empty.");
  }

  const trimmedName = name.trim();
  const trimmedMessage = message.trim();
  const operationContext = "create guestbook entry";

  console.log(`Service: Creating guestbook entry for '${trimmedName}'...`);
  const { data, error } = await supabase
    .from("guestbook")
    .insert({ name: trimmedName, message: trimmedMessage })
    .select("name, message") // Select the fields matching GuestbookEntry type
    .single(); // Expecting a single row back after insert

  // Use the utility function to handle potential errors
  handleSupabaseError(error, operationContext); // <-- REPLACED if(error) block

  // If handleSupabaseError didn't throw, check if data was returned (safeguard)
  if (!data) {
      // This case should ideally not be reached if insert succeeded without error,
      // but acts as a safeguard.
      throw new Error(`Database Error: Failed to ${operationContext}: No data returned after insert.`);
  }

  console.log("Service: Created entry successfully.");
  return data as GuestbookEntry; // Return data matching the type
}