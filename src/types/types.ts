// src/types/types.ts

// Existing GuestbookEntry type
export interface GuestbookEntry {
  name: string;
  message: string;
  // Consider adding id and created_at if you fetch/use them
  // id?: number | string;
  // created_at?: string;
}

// New Order type (adjust fields based on your actual 'orders' table schema)
export interface Order {
  id: number; // Or string if you use UUIDs
  user_id: string; // Foreign key to auth.users
  orderer_name: string;
  status: "pending" | "processing" | "completed" | "cancelled"; // Example statuses
  created_at: string; // ISO timestamp string
  // Add any other relevant fields from your orders table
  // e.g., order_details: any;
  // e.g., total_price: number;
}