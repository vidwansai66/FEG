import { z } from 'zod';

export const ConfirmSlipRequest = z.object({
  confirmed: z.literal(true)
}).strict(); // Reject extra fields like status, receiptId, etc.
