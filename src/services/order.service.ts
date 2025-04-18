import { supabase } from '../lib/supabase';
import type { Order } from '../types/types'; 
import { handleSupabaseError } from '../utils/supabaseUtils';

export async function createOrder(
    userId: string,
    ordererName: string,
    phone: string | undefined,
    packageTier: string | undefined,
    isDisadvantaged: boolean,
    isSchool: boolean,
    uploadedFileUrls: string[] | undefined,
    certificateUrl: string | undefined,

    pageCount: number | undefined,
    totalPrice: number | undefined
): Promise<Order> {

    if (!userId || !ordererName || ordererName.trim().length === 0) {
        throw new Error("Validation Error: User ID and a non-empty Orderer Name are required to create an order.");
    }

    const trimmedOrdererName = ordererName.trim();
    const trimmedPhone = phone?.trim() || undefined;
    const operationContext = "create order";

    console.log(`Service: Creating order for user '${userId}' with name '${trimmedOrdererName}', package '${packageTier || 'N/A'}', phone '${trimmedPhone || 'N/A'}'. Disadvantaged: ${isDisadvantaged}, School: ${isSchool}`);

    const insertData: Partial<Order> & { user_id: string; orderer_name: string; status: Order['status']; is_disadvantaged: boolean; is_school: boolean; } = {
      user_id: userId,
      orderer_name: trimmedOrdererName,
      status: "pending", 
      is_disadvantaged: isDisadvantaged,
      is_school: isSchool,

      ...(trimmedPhone && { phone: trimmedPhone }),
      ...(packageTier && { package_tier: packageTier }),
      ...(uploadedFileUrls && { uploaded_file_urls: uploadedFileUrls }),
      ...(certificateUrl && { certificate_url: certificateUrl }),
      ...(pageCount !== undefined && pageCount !== null && { page_count: pageCount }),
      ...(totalPrice !== undefined && totalPrice !== null && { total_price: totalPrice }),
    };

    console.log("Service: Inserting data:", insertData); 

    const { data, error } = await supabase
      .from("orders")
      .insert(insertData)
      .select() 
      .single(); 

    handleSupabaseError(error, operationContext);

     if (!data) {

      throw new Error(`Database Error: Failed to ${operationContext}: No data returned after insert.`);
     }

    console.log("Service: Created order successfully with ID:", data.id);
    return data as Order;
}