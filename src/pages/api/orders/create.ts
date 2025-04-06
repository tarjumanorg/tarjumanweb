// src/pages/api/orders/create.ts
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies }) => {
  // 1. Get submitted data
  let ordererName: string | undefined;
  try {
    const data = await request.json();
    ordererName = data.orderer_name?.toString().trim(); // Basic sanitization

    if (!ordererName) {
      return new Response(
        JSON.stringify({ error: "Orderer name is required." }),
        { status: 400 }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request body. Expected JSON." }),
      { status: 400 }
    );
  }


  // 2. Verify authentication and get user ID (Middleware should have run, but double-check)
  const accessToken = cookies.get("sb-access-token");

  if (!accessToken) {
    // This shouldn't happen if middleware is working, but belt-and-suspenders
    return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), { status: 401 });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken.value);

  if (userError || !user) {
    console.error("API /api/orders/create: Error getting user", userError);
    // Optionally attempt refresh here? Middleware should handle this primarily.
    // For simplicity in the API route, we'll rely on middleware validation.
    return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), { status: 401 });
  }

  const userId = user.id;

  // 3. Insert into Database
  try {
    const { data: newOrder, error: insertError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        orderer_name: ordererName,
        status: "pending", // Set a default status
        // Add defaults for other required fields if necessary, or handle nulls
        // page_count: 0,
        // total_price: 0,
        // package_tier: 'default',
        // uploaded_file_urls: []
      })
      .select() // Return the created row
      .single(); // Expect only one row back

    if (insertError) {
      console.error("API /api/orders/create: Supabase insert error", insertError);
      // Check for specific errors, e.g., RLS violation
      if (insertError.code === '42501') { // RLS violation code
         return new Response(
            JSON.stringify({ error: "Database permission denied. Check RLS policies." }),
            { status: 403 } // Forbidden
         );
      }
      return new Response(
        JSON.stringify({ error: "Database error: " + insertError.message }),
        { status: 500 }
      );
    }

    // 4. Return Success Response
    return new Response(JSON.stringify(newOrder), { status: 201 }); // 201 Created

  } catch (error: any) {
    console.error("API /api/orders/create: Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500 }
    );
  }
};