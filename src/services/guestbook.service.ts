// src/services/guestbook.service.ts
import { supabase } from '../lib/supabase'; // Import the initialized client
import type { GuestbookEntry } from '../types/types'; // Use our defined type

/**
 * Fetches all guestbook entries, ordered by creation date (ascending).
 * Throws an error if the Supabase query fails.
 */
export async function getAllGuestbookEntries(): Promise<GuestbookEntry[]> {
  console.log("Service: Fetching all guestbook entries...");
  const { data, error } = await supabase
    .from("guestbook")
    .select("name, message") // Select only needed fields defined in the type
    .order("created_at", { ascending: true }); // Or false based on desired display order

  if (error) {
    console.error("Service Error (getAllGuestbookEntries):", error);
    // Throw a new error to be caught by the calling API route
    throw new Error(`Failed to fetch guestbook entries: ${error.message}`);
  }

  console.log("Service: Fetched entries successfully.");
  // You might add more robust validation here depending on needs
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
  // Basic validation within the service
  if (!name || !message || name.trim().length === 0 || message.trim().length === 0) {
      throw new Error("Validation Error: Name and message cannot be empty.");
  }

  const trimmedName = name.trim();
  const trimmedMessage = message.trim();

  console.log(`Service: Creating guestbook entry for '${trimmedName}'...`);
  const { data, error } = await supabase
    .from("guestbook")
    .insert({ name: trimmedName, message: trimmedMessage })
    .select("name, message") // Select the fields matching GuestbookEntry type
    .single(); // Expecting a single row back after insert

  if (error) {
    console.error("Service Error (createGuestbookEntry):", error);
    // Check for specific Supabase errors if needed (e.g., RLS violation '42501')
    if (error.code === '42501') {
        // Make error more specific for API layer to handle
        throw new Error("Permission Denied: Cannot create guestbook entry. Check RLS policies.");
    }
    // Generic database error
    throw new Error(`Database Error: Failed to create guestbook entry: ${error.message}`);
  }

  if (!data) {
      // This case should ideally not be reached if insert succeeded without error,
      // but acts as a safeguard.
      throw new Error("Database Error: Failed to create guestbook entry: No data returned after insert.");
  }

  console.log("Service: Created entry successfully.");
  return data as GuestbookEntry; // Return data matching the type
}