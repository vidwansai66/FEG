import { z } from 'zod';

export const SlipLegInput = z.object({
  eventId: z.string().min(1),
  marketId: z.string().min(1),
  selectionId: z.string().min(1),
  acceptedOdds: z.number().positive().finite(),
  oddsTimestamp: z.string().datetime(),
  eventLabel: z.string().min(1),
  marketLabel: z.string().min(1),
  selectionLabel: z.string().min(1)
});

export const CreateSlipRequest = z.object({
  sessionId: z.string().uuid().optional(),
  stake: z.number().min(0).finite(),
  legs: z.array(SlipLegInput).min(1)
});

export const UpdateSlipRequest = z.object({
  stake: z.number().min(0).finite().optional(),
  legs: z.array(SlipLegInput).min(1).optional()
}).refine(data => data.stake !== undefined || data.legs !== undefined, {
  message: "At least one field (stake or legs) must be supplied."
});
