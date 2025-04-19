import { z } from "zod";

export const GuestbookEntrySchema = z.object({
  name: z.string().min(1, "Name is required"),
  message: z.string().min(1, "Message is required"),
});

export type GuestbookEntry = z.infer<typeof GuestbookEntrySchema>;
