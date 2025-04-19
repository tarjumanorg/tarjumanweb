import { supabase } from '../lib/supabase';
import { OrderSchema, type Order } from '../schemas/order.schema';
import { handleSupabaseError } from '../utils/supabaseUtils';

export async function createOrder(
    input: Omit<Order, 'id' | 'created_at' | 'status'>
): Promise<Order> {
    // Input is already validated by Zod in API layer
    const operationContext = "create order";
    const insertData: Partial<Order> & { user_id: string; orderer_name: string; status: Order['status']; is_disadvantaged: boolean; is_school: boolean; } = {
      ...input,
      status: "pending",
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

    // Validate with Zod before returning
    const result = OrderSchema.safeParse(data);
    if (!result.success) {
      console.error('Service: Order response validation failed:', result.error.flatten());
      throw new Error('Database Error: Invalid order returned.');
    }

    console.log("Service: Created order successfully with ID:", result.data.id);
    return result.data;
}