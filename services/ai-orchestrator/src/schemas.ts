import { z } from 'zod';

export const BettingLegIntentSchema = z.object({
  eventQuery: z.string().min(1).describe("The user's query/description for the sports event (e.g., 'Arsenal vs Chelsea', 'Lakers game'). Do NOT use IDs."),
  marketQuery: z.string().min(1).describe("The user's query/description for the betting market (e.g., 'Match Winner', 'Total Goals'). Do NOT use IDs."),
  selectionQuery: z.string().min(1).describe("The user's query/description for the specific selection/pick (e.g., 'Arsenal', 'Over 2.5'). Do NOT use IDs."),
}).strict(); // Strict ensures no extraneous fields like eventId or odds can be outputted by the AI

export const UserIntentSchema = z.object({
  action: z.enum(['build_draft_slip']).describe("The intended action of the user. Draft a bet slip."),
  stake: z.number().positive().optional().describe("The intended stake amount, if provided by the user."),
  legs: z.array(BettingLegIntentSchema).min(1).describe("The legs of the bet. A single leg is a straight bet, multiple legs form a parlay."),
}).strict();

export type BettingLegIntent = z.infer<typeof BettingLegIntentSchema>;
export type UserIntent = z.infer<typeof UserIntentSchema>;
