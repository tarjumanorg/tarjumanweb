// src/services/order.service.ts
import { supabase } from '../lib/supabase';
import type { Order } from '../types/types'; // Import the Order type
import { handleSupabaseError } from '../utils/supabaseUtils';

/**
 * Creates a new order associated with a user ID.
 * Throws an error if validation fails or the Supabase insert operation fails.
 * @param userId - The authenticated user's ID (can be anonymous user ID).
 * @param ordererName - The name provided for the order.
 * @param phone - Optional phone number.
 * @param packageTier - Text representation of the selected package.
 * @param isDisadvantaged - Boolean flag.
 * @param isSchool - Boolean flag.
 * @param uploadedFileUrls - Array of paths/URLs for main documents.
 * @param certificateUrl - Optional path/URL for the certificate.
 * @param pageCount - Optional page count.
 * @param totalPrice - Optional total price.
 * @returns The newly created order data.
 */
export async function createOrder(
    userId: string,
    ordererName: string,
    phone: string | undefined,
    packageTier: string | undefined,
    isDisadvantaged: boolean,
    isSchool: boolean,
    uploadedFileUrls: string[] | undefined,
    certificateUrl: string | undefined,
    // Optional fields, calculation deferred
    pageCount: number | undefined,
    totalPrice: number | undefined
): Promise<Order> {

    // Basic validation
    if (!userId || !ordererName || ordererName.trim().length === 0) {
        throw new Error("Validation Error: User ID and a non-empty Orderer Name are required to create an order.");
    }

    const trimmedOrdererName = ordererName.trim();
    const trimmedPhone = phone?.trim() || undefined;
    const operationContext = "create order";

    console.log(`Service: Creating order for user '${userId}' with name '${trimmedOrdererName}', package '${packageTier || 'N/A'}', phone '${trimmedPhone || 'N/A'}'. Disadvantaged: ${isDisadvantaged}, School: ${isSchool}`);

    // Prepare data for insertion based on the Order type
    const insertData: Partial<Order> & { user_id: string; orderer_name: string; status: Order['status']; is_disadvantaged: boolean; is_school: boolean; } = {
      user_id: userId,
      orderer_name: trimmedOrdererName,
      status: "pending", // Set default status
      is_disadvantaged: isDisadvantaged,
      is_school: isSchool,
      // Map optional fields only if they have a value
      ...(trimmedPhone && { phone: trimmedPhone }),
      ...(packageTier && { package_tier: packageTier }),
      ...(uploadedFileUrls && { uploaded_file_urls: uploadedFileUrls }),
      ...(certificateUrl && { certificate_url: certificateUrl }),
      ...(pageCount !== undefined && pageCount !== null && { page_count: pageCount }),
      ...(totalPrice !== undefined && totalPrice !== null && { total_price: totalPrice }),
    };

    console.log("Service: Inserting data:", insertData); // Log the object being sent to Supabase

    const { data, error } = await supabase
      .from("orders")
      .insert(insertData)
      .select() // Select all fields defined in the Order type
      .single(); // Expecting one row back

    // Use the utility function to handle potential errors
    handleSupabaseError(error, operationContext);

     // If handleSupabaseError didn't throw, check if data was returned (safeguard)
     if (!data) {
      // Safeguard against unexpected null data after successful insert
      throw new Error(`Database Error: Failed to ${operationContext}: No data returned after insert.`);
     }

    console.log("Service: Created order successfully with ID:", data.id);
    return data as Order;
}

// Potential future functions:
// export async function getOrderById(orderId: number): Promise<Order | null> { ... }
// export async function updateOrderStatus(orderId: number, status: Order['status']): Promise<Order> { ... }
// export async function getOrdersByUserId(userId: string): Promise<Order[]> { ... }