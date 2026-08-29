export declare const BACKEND_URL: string;
export type BackendSlipLeg = {
    eventId: string;
    marketId: string;
    selectionId: string;
    acceptedOdds: number;
    oddsTimestamp: string;
    eventLabel: string;
    marketLabel: string;
    selectionLabel: string;
};
export type CreateSlipPayload = {
    sessionId?: string;
    stake: number;
    legs: BackendSlipLeg[];
};
export type UpdateSlipPayload = Partial<CreateSlipPayload>;
export declare function createDraftSlip(payload: CreateSlipPayload): Promise<any>;
export declare function getSlip(slipId: string): Promise<any>;
export declare function updateDraftSlip(slipId: string, payload: UpdateSlipPayload): Promise<any>;
export declare function validateDraftSlip(slipId: string): Promise<{
    ok: boolean;
    status: number;
    error: any;
    data?: never;
} | {
    status?: never;
    error?: never;
    ok: boolean;
    data: any;
}>;
//# sourceMappingURL=backendClient.d.ts.map