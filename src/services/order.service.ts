// src/services/order.service.ts
import { supabase } from '../lib/supabase';
import type { Order } from '../types/types'; // Import the Order type
import { handleSupabaseError } from '../utils/supabaseUtils'; // <-- IMPORT ADDED

/**
 * Creates a new order associated with a user ID.
 * Throws an error if validation fails or the Supabase insert operation fails.
 * @param userId - The authenticated user's ID (can be anonymous user ID).
 * @param ordererName - The name provided for the order.
 * @returns The newly created order data.
 */
export async function createOrder(userId: string, ordererName: string): Promise<Order> {
    // Basic validation (remains unchanged)
    if (!userId || !ordererName || ordererName.trim().length === 0) {
        throw new Error("Validation Error: User ID and a non-empty Orderer Name are required to create an order.");
    }

    const trimmedOrdererName = ordererName.trim();
    const operationContext = "create order";

    console.log(`Service: Creating order for user '${userId}' with name '${trimmedOrdererName}'...`);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        orderer_name: trimmedOrdererName,
        status: "pending", // Set default status
      })
      .select() // Select all fields of the new order defined in the Order type
      .single(); // Expecting one row back

    // Use the utility function to handle potential errors
    handleSupabaseError(error, operationContext); // <-- REPLACED if(error) block

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