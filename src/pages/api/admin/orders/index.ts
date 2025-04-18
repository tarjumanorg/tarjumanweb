// src/pages/api/admin/orders/index.ts
// Fetches ALL orders - Uses the admin client (Service Role Key)
import type { APIRoute } from "astro";
// Import the admin client
import { supabaseAdmin } from "../../../../lib/supabaseAdmin"; // <--- Uses admin client
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils"; // Still useful for non-RLS errors
import type { Order } from "../../../../types/types";

// GET handler for fetching ALL orders
export const GET: APIRoute = async ({ locals }) => {
    const adminUserId = locals.userId; // Verify the CALLER is an admin (done by middleware)

    // Middleware MUST have already verified this user is an admin and set locals.userId
    if (!adminUserId) {
         // This check is a safeguard, middleware should prevent reaching here without auth
         console.error("API Error (GET /api/admin/orders): Admin user ID not found in locals. Middleware might be misconfigured or bypassed.");
         return jsonErrorResponse(401, "Unauthorized: Admin session context missing.");
    }
    console.log(`API Route: GET /api/admin/orders invoked by verified admin user ${adminUserId}. Using service client for DB query.`);

    try {
        // Use the admin client which bypasses RLS
        const { data, error } = await supabaseAdmin // <--- Uses admin client
            .from("orders")
            .select(`
                id,
                created_at,
                orderer_name,
                status,
                package_tier,
                user_id
            `) // Select only necessary fields for the list
            .order("created_at", { ascending: false }); // Show newest first

        // handleSupabaseError is still useful for connection errors, table not found, etc.
        // It won't throw RLS errors here because the service key bypasses them.
        handleSupabaseError(error, "fetch all orders (admin service)");

        console.log(`API Route: Fetched ${data?.length ?? 0} orders using admin service client.`);
        return jsonResponse(200, data as Order[] || []); // Return empty array if data is null

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders with service client):`, error.message);
        // handleSupabaseError might have already thrown a standard error
        return jsonErrorResponse(500, `Failed to retrieve orders: ${error.message}`);
    }
}