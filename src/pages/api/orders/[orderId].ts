import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { OrderSchema, UserOrderDetailSchema } from "../../../schemas/order.schema";
import { jsonResponse, jsonErrorResponse } from '../../../utils/apiResponse';
import { z } from "zod";
import { PACKAGES_DETAILS_MAP } from '../../../utils/constants';
import { enrichUserOrderWithSignedUrls } from '../../../utils/supabaseUtils';

// GET /api/orders/[orderId]
export const GET: APIRoute = async ({ params, locals }) => {
  const userId = locals.userId;
  const orderId = params.orderId;
  if (!userId) return jsonErrorResponse(401, "Unauthorized: User not logged in.");
  const idNumResult = z.coerce.number().int().positive().safeParse(orderId);
  if (!idNumResult.success) return jsonErrorResponse(400, "Invalid Order ID.");
  const idNum = idNumResult.data;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", idNum)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return jsonErrorResponse(500, error.message);
  if (!data) return jsonErrorResponse(404, "Order not found.");
  
  // Parse and validate base order data
  const parseResult = OrderSchema.safeParse(data);
  if (!parseResult.success) return jsonErrorResponse(500, 'Internal server error: Invalid order data.');
  
  // Enrich order with signed URLs
  const enrichedOrder = await enrichUserOrderWithSignedUrls(parseResult.data);
  
  // Validate enriched order structure
  const enrichedResult = UserOrderDetailSchema.safeParse(enrichedOrder);
  if (!enrichedResult.success) return jsonErrorResponse(500, 'Internal server error: Invalid enriched order data.');
  
  return jsonResponse(200, enrichedResult.data);
};

// PATCH /api/orders/[orderId]
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const userId = locals.userId;
  const orderId = params.orderId;
  if (!userId) return jsonErrorResponse(401, "Unauthorized: User not logged in.");
  const idNumResult = z.coerce.number().int().positive().safeParse(orderId);
  if (!idNumResult.success) return jsonErrorResponse(400, "Invalid Order ID.");
  const idNum = idNumResult.data;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonErrorResponse(400, "Invalid JSON body.");
  }
  const bodySchema = z.object({ packageIdentifier: z.string() });
  const bodyResult = bodySchema.safeParse(body);
  if (!bodyResult.success) return jsonErrorResponse(400, bodyResult.error.flatten());
  const { packageIdentifier } = bodyResult.data;

  // Fetch current order
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", idNum)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return jsonErrorResponse(500, error.message);
  if (!order) return jsonErrorResponse(404, "Order not found.");
  if (!order.page_count || order.page_count <= 0) return jsonErrorResponse(409, "Page count not yet confirmed by admin.");
  if (order.status !== "Pending Package Confirmation") return jsonErrorResponse(409, "Order is not awaiting package confirmation.");

  const pkg = PACKAGES_DETAILS_MAP[packageIdentifier];
  if (!pkg) return jsonErrorResponse(400, "Invalid package selected.");
  const newTotalPrice = order.page_count * pkg.pricePerPage;
  const now = new Date();
  const estimatedDelivery = new Date(now.getTime() + pkg.turnaroundDays * 24 * 60 * 60 * 1000);

  const updatePayload = {
    package_tier: pkg.name,
    total_price: newTotalPrice,
    estimated_delivery_date: estimatedDelivery.toISOString(),
    status: "Pending Payment"
  };
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", idNum)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (updateError) return jsonErrorResponse(500, updateError.message);
  if (!updated) return jsonErrorResponse(500, "Order update failed.");
  
  // Validate the updated order data
  const parseResult = OrderSchema.safeParse(updated);
  if (!parseResult.success) {
      console.error('PATCH response validation failed:', parseResult.error.flatten());
      return jsonErrorResponse(500, 'Internal server error: Invalid data format');
  }
  
  return jsonResponse(200, parseResult.data);
};
