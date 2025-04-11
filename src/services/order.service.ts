// src/services/order.service.ts
import { supabase } from '../lib/supabase';
import type { Order } from '../types/types'; // Import the Order type
import { handleSupabaseError } from '../utils/supabaseUtils';

/**
 * Creates a new order associated with a user ID.
 * Throws an error if validation fails or the Supabase insert operation fails.
 * @param userId - The authenticated user's ID (can be anonymous user ID).
 * @param ordererName - The name provided for the order.
 * @param phone - The phone number provided for the order (optional). // UPDATED DOC
 * @returns The newly created order data.
 */
// UPDATED: Function signature to accept optional phone
export async function createOrder(userId: string, ordererName: string, phone?: string): Promise<Order> {
    // Basic validation
    if (!userId || !ordererName || ordererName.trim().length === 0) {
        throw new Error("Validation Error: User ID and a non-empty Orderer Name are required to create an order.");
    }
    // Optional: Add more specific validation for phone format here if needed

    const trimmedOrdererName = ordererName.trim();
    // Trim phone only if it exists, otherwise ensure it's undefined/null
    const trimmedPhone = phone?.trim() || undefined;
    const operationContext = "create order";

    // UPDATED: Logging to include phone
    console.log(`Service: Creating order for user '${userId}' with name '${trimmedOrdererName}' and phone '${trimmedPhone || 'N/A'}'...`);

    // Prepare data for insertion, using Partial<Order> for better type checking
    const insertData: Partial<Order> & { user_id: string; orderer_name: string; status: Order['status'] } = {
      user_id: userId,
      orderer_name: trimmedOrdererName,
      status: "pending", // Set default status
      // Intentionally omit other fields unless they have default values to set here
    };

    // Conditionally add phone to the insert object only if it has a value
    if (trimmedPhone) {
      insertData.phone = trimmedPhone;
    }
    // Similarly, add other optional fields here if they are passed and have values

    console.log("Service: Inserting data:", insertData); // Log the object being sent to Supabase

    const { data, error } = await supabase
      .from("orders")
      // UPDATED: Use the prepared insertData object
      .insert(insertData)
      .select() // Select all fields defined in the Order type (should now include phone)
      .single(); // Expecting one row back

    // Use the utility function to handle potential errors
    handleSupabaseError(error, operationContext);

     // If handleSupabaseError didn't throw, check if data was returned (safeguard)
     if (!data) {
      // Safeguard against unexpected null data after successful insert
      throw new Error(`Database Error: Failed to ${operationContext}: No data returned after insert.`);
     }

    console.log("Service: Created order successfully with ID:", data.id);
    // The returned 'data' object from Supabase should include the 'phone' field
    // if it was successfully inserted according to the .select()
    return data as Order;
}

// Potential future functions:
// export async function getOrderById(orderId: number): Promise<Order | null> { ... }
// export async function updateOrderStatus(orderId: number, status: Order['status']): Promise<Order> { ... }
// export async function getOrdersByUserId(userId: string): Promise<Order[]> { ... }