import type { APIRoute } from "astro";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin"; 
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils"; 
import type { Order } from '../../../../schemas/order.schema';
import { OrderSchema } from '../../../../schemas/order.schema';

export const GET: APIRoute = async ({ locals }) => {
    const adminUserId = locals.userId; 

    if (!adminUserId) {

         console.error("API Error (GET /api/admin/orders): Admin user ID not found in locals. Middleware might be misconfigured or bypassed.");
         return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: GET /api/admin/orders invoked by verified admin user ${adminUserId}. Using service client for DB query.`);

    try {

        const { data, error } = await supabaseAdmin 
            .from("orders")
            .select(`
                id,
                created_at,
                orderer_name,
                status,
                package_tier,
                user_id
            `) 
            .order("created_at", { ascending: false }); 

        handleSupabaseError(error, "fetch all orders (admin service)");

        const ResponseOrderSchema = OrderSchema.pick({
          id: true,
          created_at: true,
          orderer_name: true,
          status: true,
          package_tier: true,
          user_id: true,
        });
        const parseResult = ResponseOrderSchema.array().safeParse(data);
        if (!parseResult.success) {
          console.error('Admin Orders GET response validation failed:', parseResult.error.flatten());
  }
        return jsonResponse(200, data as Order[] || []); 

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders with service client):`, error.message);

        return jsonErrorResponse(500, `Failed to retrieve orders: ${error.message}`);
    }
}