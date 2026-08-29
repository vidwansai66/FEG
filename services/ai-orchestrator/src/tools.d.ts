import { z } from 'zod';
export declare const SearchEventsTool: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        query: z.ZodString;
    }, z.core.$strict>;
};
export declare const SearchMarketsTool: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        eventId: z.ZodString;
        query: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
};
export declare const ResolveSelectionTool: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        marketId: z.ZodString;
        selectionQuery: z.ZodString;
    }, z.core.$strict>;
};
export declare const GetCurrentOddsTool: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        selectionIds: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
};
//# sourceMappingURL=tools.d.ts.map