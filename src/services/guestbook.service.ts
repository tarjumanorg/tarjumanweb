import { supabase } from '../lib/supabase'; 
import { GuestbookEntrySchema, type GuestbookEntry } from '../schemas/guestbook.schema';
import { handleSupabaseError } from '../utils/supabaseUtils'; 

export async function getAllGuestbookEntries(): Promise<GuestbookEntry[]> {
  const operationContext = "fetch guestbook entries";
  console.log(`Service: ${operationContext}...`);

  const { data, error } = await supabase
    .from("guestbook")
    .select("name, message") 
    .order("created_at", { ascending: true }); 

  handleSupabaseError(error, operationContext); 

  // Validate with Zod before returning
  const result = GuestbookEntrySchema.array().safeParse(data);
  if (!result.success) {
    console.error('Service: Guestbook entries response validation failed:', result.error.flatten());
    return [];
  }

  console.log("Service: Fetched entries successfully.");
  return result.data;
}

export async function createGuestbookEntry(entry: Pick<GuestbookEntry, 'name' | 'message'>): Promise<GuestbookEntry> {
  const trimmedName = entry.name.trim();
  const trimmedMessage = entry.message.trim();
  const operationContext = "create guestbook entry";

  console.log(`Service: Creating guestbook entry for '${trimmedName}'...`);
  const { data, error } = await supabase
    .from("guestbook")
    .insert({ name: trimmedName, message: trimmedMessage })
    .select("name, message") 
    .single(); 

  handleSupabaseError(error, operationContext); 

  if (!data) {
    throw new Error(`Database Error: Failed to ${operationContext}: No data returned after insert.`);
  }

  // Validate with Zod before returning
  const result = GuestbookEntrySchema.safeParse(data);
  if (!result.success) {
    console.error('Service: Guestbook entry response validation failed:', result.error.flatten());
    throw new Error('Database Error: Invalid guestbook entry returned.');
  }

  console.log("Service: Created entry successfully.");
  return result.data;
}