import { describe, it, expect, vi, beforeEach } from 'vitest';
import { slipService, SlipError } from './slipService.js';
import { supabase } from '../config/supabase.js';

vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('SlipService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockDbSelect = (data: any, error: any = null) => {
    const single = vi.fn().mockResolvedValue({ data, error });
    const order = vi.fn().mockResolvedValue({ data, error });
    const eq = vi.fn().mockReturnValue({ single, order });
    const select = vi.fn().mockReturnValue({ eq, single });
    return { select };
  };

  const mockDbChain = (operation: string, data: any, error: any = null) => {
    const single = vi.fn().mockResolvedValue({ data, error });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select, single });
    const opFn = vi.fn().mockReturnValue({ select, eq, single });
    
    // For pure return values where no chaining happens after op
    opFn.mockResolvedValue({ data, error });
    opFn.mockReturnValue({ select, eq, single, then: (cb: any) => cb({ data, error }) });

    return opFn;
  };

  it('creates a slip with a new session', async () => {
    const insertSession = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'sess_1' }, error: null }) }) });
    const insertSlip = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'slip_1', session_id: 'sess_1', total_stake: 100, status: 'DRAFT' }, error: null }) }) });
    const insertLegs = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 'leg_1', leg_index: 0 }], error: null }) });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'sessions') return { insert: insertSession };
      if (table === 'draft_slips') return { insert: insertSlip };
      if (table === 'slip_legs') return { insert: insertLegs };
    });

    const result = await slipService.createSlip({
      stake: 100,
      legs: [{ eventId: 'e1', marketId: 'm1', selectionId: 's1', acceptedOdds: 1.5, oddsTimestamp: '2026-08-29T10:00:00Z', eventLabel: 'E', marketLabel: 'M', selectionLabel: 'S' }]
    });

    expect(result.id).toBe('slip_1');
    expect(result.sessionId).toBe('sess_1');
  });

  it('fails to patch a non-DRAFT slip', async () => {
    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'slip_1', status: 'VALIDATED' }, error: null })
      })
    });
    
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'draft_slips') return { select: selectFn };
    });

    await expect(slipService.updateSlip('slip_1', { stake: 200 })).rejects.toThrow(SlipError);
  });

  it('deletes a DRAFT slip', async () => {
    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { status: 'DRAFT' }, error: null })
      })
    });
    const deleteFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'draft_slips') return { select: selectFn, delete: deleteFn };
    });

    const res = await slipService.deleteSlip('slip_1');
    expect(res.success).toBe(true);
  });
});
