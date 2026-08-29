import { z } from 'zod';

export const ValidateSlipRequest = z.object({
  slipId: z.string().uuid()
});
