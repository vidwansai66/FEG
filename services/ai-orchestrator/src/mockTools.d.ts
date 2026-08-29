import { z } from "zod";
import { SearchEventsTool, SearchMarketsTool, ResolveSelectionTool, GetCurrentOddsTool } from "./tools.js";
export declare const mockSearchEvents: (input: z.infer<typeof SearchEventsTool.inputSchema>) => Promise<any[]>;
export declare const mockSearchMarkets: (input: z.infer<typeof SearchMarketsTool.inputSchema>) => Promise<any[]>;
export declare const mockResolveSelection: (input: z.infer<typeof ResolveSelectionTool.inputSchema>) => Promise<any>;
export declare const mockGetCurrentOdds: (input: z.infer<typeof GetCurrentOddsTool.inputSchema>) => Promise<any[]>;
//# sourceMappingURL=mockTools.d.ts.map