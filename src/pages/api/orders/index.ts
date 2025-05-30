import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { OrderSchema } from "../../../schemas/order.schema";
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse';

export const GET: APIRoute = async ({ locals }) => {
  const userId = locals.userId;
  if (!userId) {
    return jsonErrorResponse(401, "Unauthorized: User not logged in.");
  }

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, orderer_name, status, created_at, page_count, package_tier, total_price, estimated_delivery_date")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonErrorResponse(500, error.message);
    }

    // Validate response data (optional but recommended)
    const parseResult = OrderSchema.pick({
      id: true,
      orderer_name: true,
      status: true,
      created_at: true,
      page_count: true,
      package_tier: true,
      total_price: true,
      estimated_delivery_date: true,
    }).array().safeParse(data);
    if (!parseResult.success) {
      return jsonErrorResponse(500, 'Internal server error: Invalid data format for orders.');
    }

    return jsonResponse(200, parseResult.data);
  } catch (e: any) {
    return jsonErrorResponse(500, e.message || 'Unknown error');
  }
};
