import { z } from 'zod';
export declare const BettingLegIntentSchema: z.ZodObject<{
    eventQuery: z.ZodString;
    marketQuery: z.ZodString;
    selectionQuery: z.ZodString;
}, z.core.$strict>;
export declare const UserIntentSchema: z.ZodObject<{
    action: z.ZodEnum<{
        build_draft_slip: "build_draft_slip";
    }>;
    stake: z.ZodOptional<z.ZodNumber>;
    legs: z.ZodArray<z.ZodObject<{
        eventQuery: z.ZodString;
        marketQuery: z.ZodString;
        selectionQuery: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type BettingLegIntent = z.infer<typeof BettingLegIntentSchema>;
export type UserIntent = z.infer<typeof UserIntentSchema>;
//# sourceMappingURL=schemas.d.ts.map