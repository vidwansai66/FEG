import { z } from "zod";
import { SearchEventsTool, SearchMarketsTool, ResolveSelectionTool, GetCurrentOddsTool } from "./tools.js";
export declare const searchEvents: (input: z.infer<typeof SearchEventsTool.inputSchema>) => Promise<any>;
export declare const searchMarkets: (input: z.infer<typeof SearchMarketsTool.inputSchema>) => Promise<any>;
export declare const resolveSelection: (input: z.infer<typeof ResolveSelectionTool.inputSchema> & {
    eventId?: string;
}) => Promise<{
    candidates: any;
}>;
export declare const getCurrentOdds: (input: z.infer<typeof GetCurrentOddsTool.inputSchema>) => Promise<any>;
//# sourceMappingURL=sportsClient.d.ts.map