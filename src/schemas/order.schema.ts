import { z } from "zod";

export const OrderSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.string(),
  orderer_name: z.string().min(1, "Orderer name is required"),
  status: z.enum([
    "pending", // legacy: will be replaced by new statuses below
    "processing", // legacy
    "completed", // legacy
    "cancelled", // legacy
    "Pending Page Count",
    "Pending Package Confirmation",
    "Pending Payment",
    "In Progress",
    "Delivered",
    "Rejected"
  ]),
  created_at: z.string(),
  phone: z.string().nullable().optional(),
  package_tier: z.string().nullable().optional(),
  page_count: z.number().int().nonnegative().nullable().optional(),
  total_price: z.number().nonnegative().nullable().optional(),
  uploaded_file_urls: z.array(z.string()).nullable().optional(),
  is_disadvantaged: z.boolean(),
  is_school: z.boolean(),
  certificate_url: z.string().nullable().optional(),
  translated_file_url: z.string().nullable().optional(),
  estimated_delivery_date: z.string().datetime({ offset: true }).nullable().optional(),
});

export const CreateOrderInputSchema = z.object({
  orderer_name: z.string().min(1, "Orderer name is required"),
  phone: z.string().optional(),
  package_tier_value: z.string().min(1, "Package tier is required"),
  is_disadvantaged: z.boolean(),
  is_school: z.boolean(),
  turnstile_token: z.string().min(1, "CAPTCHA token is required"),
});

export const SignedFileInfoSchema = z.object({
  path: z.string(),
  filename: z.string().nullable(),
  signedUrl: z.string().nullable(),
});

export const AdminOrderDetailResponseSchema = OrderSchema.extend({
  uploaded_files_info: z.array(SignedFileInfoSchema.nullable()).optional(),
  certificate_info: SignedFileInfoSchema.nullable().optional(),
  translated_file_info: SignedFileInfoSchema.nullable().optional(),
});

export const UserOrderDetailSchema = OrderSchema.extend({
  uploaded_files_info: z.array(z.object({ url: z.string() })),
  certificate_info: z.object({ url: z.string() }).nullable()
});

export const UpdateOrderPayloadSchema = z.object({
  status: z.enum([
    "pending",
    "processing",
    "completed",
    "cancelled",
    "Pending Page Count",
    "Pending Package Confirmation",
    "Pending Payment",
    "In Progress",
    "Delivered",
    "Rejected"
  ]).nullable().optional(),
  page_count: z.number().int().nonnegative().nullable().optional(),
  package_tier: z.string().nullable().optional(),
  estimated_delivery_date: z.string().datetime({ offset: true }).nullable().optional(),
}).partial();

export type Order = z.infer<typeof OrderSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
export type SignedFileInfo = z.infer<typeof SignedFileInfoSchema>;
export type AdminOrderDetailResponse = z.infer<typeof AdminOrderDetailResponseSchema>;
export type UpdateOrderPayload = z.infer<typeof UpdateOrderPayloadSchema>;
