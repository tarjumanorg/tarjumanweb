import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { STORAGE_BUCKET } from './constants';
import type { Order } from '../schemas/order.schema';

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

export async function enrichUserOrderWithSignedUrls(order: Order) {
  const { data: uploadedFiles } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(order.uploaded_file_urls || [], 60 * 60); // 1hr expiry

  let certificate_info = null;
  if (order.certificate_url) {
      const { data: certificate } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(order.certificate_url, 60 * 60) as { data: { signedUrl: string } | null };
      certificate_info = certificate ? { url: certificate.signedUrl } : null;
  }

  return {
      ...order,
      uploaded_files_info: (uploadedFiles || []).map((file: { signedUrl: string }) => ({ url: file.signedUrl })),
      certificate_info
  };
}