// src/pages/api/admin/orders/index.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../../lib/supabase";
import { jsonResponse, jsonErrorResponse } from '../../../../utils/apiResponse';
import { handleSupabaseError } from "../../../../utils/supabaseUtils";
import type { Order } from "../../../../types/types";

// GET handler for fetching ALL orders
export const GET: APIRoute = async ({ locals }) => {
    const adminUserId = locals.userId; // Middleware ensures this is an admin
    console.log(`API Route: GET /api/admin/orders invoked by admin user ${adminUserId}.`);

    // No orderId expected here

    try {
        // Select fields needed for the list view, order by creation date
        const { data, error } = await supabase
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

        handleSupabaseError(error, "fetch all orders (admin)");

        // data will be an array of orders or null/empty array
        console.log(`API Route: Fetched ${data?.length ?? 0} orders for admin.`);
        return jsonResponse(200, data as Order[] || []); // Return empty array if data is null

    } catch (error: any) {
        console.error(`API Error (GET /api/admin/orders):`, error.message);
        if (error.message.includes("Permission Denied")) {
            return jsonErrorResponse(403, error.message);
        }
        // Generic error for other issues
        return jsonErrorResponse(500, `Failed to retrieve orders: ${error.message}`);
    }
}

// You might add POST here if needed, but usually POST is for creating a single resource
// For now, only GET makes sense for the index route.