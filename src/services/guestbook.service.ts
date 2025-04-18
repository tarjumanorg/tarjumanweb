import { supabase } from '../lib/supabase'; 
import type { GuestbookEntry } from '../types/types'; 
import { handleSupabaseError } from '../utils/supabaseUtils'; 

export async function getAllGuestbookEntries(): Promise<GuestbookEntry[]> {
  const operationContext = "fetch guestbook entries";
  console.log(`Service: ${operationContext}...`);

  const { data, error } = await supabase
    .from("guestbook")
    .select("name, message") 
    .order("created_at", { ascending: true }); 

  handleSupabaseError(error, operationContext); 

  console.log("Service: Fetched entries successfully.");
  return data as GuestbookEntry[];
}

export async function createGuestbookEntry(name: string, message: string): Promise<GuestbookEntry> {

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
    .select("name, message") 
    .single(); 

  handleSupabaseError(error, operationContext); 

  if (!data) {

      throw new Error(`Database Error: Failed to ${operationContext}: No data returned after insert.`);
  }

  console.log("Service: Created entry successfully.");
  return data as GuestbookEntry; 
}