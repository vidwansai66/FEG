import { describe, it, expect, vi, beforeEach } from 'vitest';
import { slipConfirmationService } from './slipConfirmationService.js';
import { supabase } from '../config/supabase.js';
import { sportsClient } from '../clients/sportsClient.js';
import { slipStateMachine } from './slipStateMachine.js';
import { SlipError } from './slipService.js';

vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}));

vi.mock('../clients/sportsClient.js', () => ({
  sportsClient: {
    validateSlip: vi.fn(),
    confirmDemoBet: vi.fn()
  }
}));

vi.mock('./slipStateMachine.js', () => ({
  slipStateMachine: {
    transition: vi.fn()
  }
}));

describe('SlipConfirmationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupSupabaseMock = (slip: any, legs: any[]) => {
    const slipSelect = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: slip, error: !slip ? new Error('Not found') : null }) });
    const legsSelect = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: legs, error: null }) });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'draft_slips') return { select: vi.fn().mockReturnValue({ eq: slipSelect }) };
      if (table === 'slip_legs') return { select: vi.fn().mockReturnValue({ eq: legsSelect }) };
    });
  };

  it('1. missing slip', async () => {
    setupSupabaseMock(null, []);
    await expect(slipConfirmationService.confirmSlip('s1')).rejects.toThrow(/not found/);
  });

  it('2. DRAFT confirmation rejected', async () => {
    setupSupabaseMock({ id: 's1', status: 'DRAFT' }, []);
    await expect(slipConfirmationService.confirmSlip('s1')).rejects.toThrow(/Cannot confirm a slip in state: DRAFT/);
  });

  it('3. USER_CONFIRMED repeated confirmation rejected', async () => {
    setupSupabaseMock({ id: 's1', status: 'USER_CONFIRMED' }, []);
    await expect(slipConfirmationService.confirmSlip('s1')).rejects.toThrow(/already confirmed/);
  });

  it('4. DEMO_CONFIRMED repeated confirmation rejected', async () => {
    setupSupabaseMock({ id: 's1', status: 'DEMO_CONFIRMED' }, []);
    await expect(slipConfirmationService.confirmSlip('s1')).rejects.toThrow(/already confirmed/);
  });

  it('5. final Member 3 validation succeeds and demo confirmation success', async () => {
    setupSupabaseMock({ id: 's1', status: 'VALIDATED' }, [{ event_id: 'e1', market_id: 'm1', selection_id: 'sel1', accepted_odds: 2.0, odds_timestamp: '2026-08-29T10:00:00Z' }]);
    
    (sportsClient.validateSlip as any).mockResolvedValue({
      ok: true,
      data: { valid: true, issues: [], currentOdds: [{ decimalOdds: 2.0 }] }
    });

    (sportsClient.confirmDemoBet as any).mockResolvedValue({
      ok: true,
      data: { receiptId: 'r-123' }
    });

    const res = await slipConfirmationService.confirmSlip('s1');
    expect(res.status).toBe('DEMO_CONFIRMED');
    expect(res.receiptId).toBe('r-123');

    expect(slipStateMachine.transition).toHaveBeenCalledWith('s1', 'VALIDATED', 'USER_CONFIRMED');
    expect(slipStateMachine.transition).toHaveBeenCalledWith('s1', 'USER_CONFIRMED', 'DEMO_CONFIRMED', { receipt_id: 'r-123' });
  });

  it('6. ODDS_CHANGED blocks confirmation', async () => {
    setupSupabaseMock({ id: 's1', status: 'VALIDATED' }, [{ event_id: 'e1', market_id: 'm1', selection_id: 'sel1', accepted_odds: 2.0, odds_timestamp: '2026-08-29T10:00:00Z' }]);
    
    (sportsClient.validateSlip as any).mockResolvedValue({
      ok: true,
      data: { valid: false, issues: [{ code: 'ODDS_CHANGED', message: 'Odds changed' }], currentOdds: [] }
    });

    await expect(slipConfirmationService.confirmSlip('s1')).rejects.toThrow(/Final revalidation failed/);
    expect(sportsClient.confirmDemoBet).not.toHaveBeenCalled();
    expect(slipStateMachine.transition).not.toHaveBeenCalledWith('s1', 'USER_CONFIRMED', 'DEMO_CONFIRMED', expect.anything());
  });

  it('7. Member 3 unavailable blocks confirmation', async () => {
    setupSupabaseMock({ id: 's1', status: 'VALIDATED' }, [{ event_id: 'e1', market_id: 'm1', selection_id: 'sel1', accepted_odds: 2.0, odds_timestamp: '2026-08-29T10:00:00Z' }]);
    
    (sportsClient.validateSlip as any).mockResolvedValue({
      ok: false,
      error: 'Service Unavailable'
    });

    await expect(slipConfirmationService.confirmSlip('s1')).rejects.toThrow(/unavailable/);
    expect(sportsClient.confirmDemoBet).not.toHaveBeenCalled();
  });

  it('8. demo confirmation failure preserves state and throws', async () => {
    setupSupabaseMock({ id: 's1', status: 'VALIDATED' }, [{ event_id: 'e1', market_id: 'm1', selection_id: 'sel1', accepted_odds: 2.0, odds_timestamp: '2026-08-29T10:00:00Z' }]);
    
    (sportsClient.validateSlip as any).mockResolvedValue({
      ok: true,
      data: { valid: true, issues: [], currentOdds: [{ decimalOdds: 2.0 }] }
    });

    (sportsClient.confirmDemoBet as any).mockResolvedValue({
      ok: false,
      error: 'Failed to place bet'
    });

    await expect(slipConfirmationService.confirmSlip('s1')).rejects.toThrow(/Demo confirmation failed/);
    expect(slipStateMachine.transition).not.toHaveBeenCalledWith('s1', 'USER_CONFIRMED', 'DEMO_CONFIRMED', expect.anything());
  });
});
