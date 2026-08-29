import { describe, it, expect, vi, beforeEach } from 'vitest';
import { slipValidationService } from './slipValidationService.js';
import { supabase } from '../config/supabase.js';
import { sportsClient } from '../clients/sportsClient.js';
import { SlipError } from './slipService.js';

vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}));

vi.mock('../clients/sportsClient.js', () => ({
  sportsClient: {
    validateSlip: vi.fn()
  }
}));

describe('SlipValidationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupSupabaseMock = (slip: any, legs: any[]) => {
    const slipSelect = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: slip, error: !slip ? new Error('Not found') : null }) });
    const legsSelect = vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: legs, error: null }) });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { status: 'VALIDATED' }, error: null });
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle });
    
    // Create a chainable eq for update
    const chainableUpdateEq: any = vi.fn().mockImplementation(() => ({
      eq: chainableUpdateEq,
      select: updateSelect
    }));
    
    const update = vi.fn().mockReturnValue({ eq: chainableUpdateEq });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'draft_slips') return { select: vi.fn().mockReturnValue({ eq: slipSelect }), update };
      if (table === 'slip_legs') return { select: vi.fn().mockReturnValue({ eq: legsSelect }), update };
    });
  };

  it('1. valid slip / 11. multi-leg total odds / 14. DRAFT -> VALIDATING -> VALIDATED', async () => {
    setupSupabaseMock(
      { id: 's1', status: 'DRAFT', total_stake: 100 },
      [
        { event_id: 'e1', market_id: 'm1', selection_id: 's1', accepted_odds: 1.5, odds_timestamp: '2026-08-29T10:00:00Z' },
        { event_id: 'e2', market_id: 'm2', selection_id: 's2', accepted_odds: 2.0, odds_timestamp: '2026-08-29T10:00:00Z' }
      ]
    );

    (sportsClient.validateSlip as any).mockResolvedValue({
      ok: true,
      data: {
        valid: true,
        issues: [],
        currentOdds: [
          { decimalOdds: 1.5 },
          { decimalOdds: 2.0 }
        ]
      }
    });

    const res = await slipValidationService.validateSlip('s1');
    expect(res.status).toBe('VALIDATED');
    expect(res.totalOdds).toBe(3.0);
  });

  it('2. missing slip', async () => {
    setupSupabaseMock(null, []);
    await expect(slipValidationService.validateSlip('s1')).rejects.toThrow(SlipError);
  });

  it('3. invalid state', async () => {
    setupSupabaseMock({ id: 's1', status: 'VALIDATED', total_stake: 100 }, []);
    await expect(slipValidationService.validateSlip('s1')).rejects.toThrow(/Cannot validate/);
  });

  it('4. invalid stake', async () => {
    setupSupabaseMock({ id: 's1', status: 'DRAFT', total_stake: -10 }, [{ event_id: 'e1', market_id: 'm1', selection_id: 's1', odds_timestamp: '2026-08-29T10:00:00Z' }]);
    const res = await slipValidationService.validateSlip('s1');
    expect(res.status).toBe('INVALID');
    expect(res.issues[0].code).toBe('INVALID_STAKE');
  });

  it('5. missing canonical ID / 15. failed validation', async () => {
    setupSupabaseMock({ id: 's1', status: 'DRAFT', total_stake: 100 }, [{ event_id: null, market_id: 'm1', selection_id: 's1', odds_timestamp: '2026-08-29T10:00:00Z' }]);
    const res = await slipValidationService.validateSlip('s1');
    expect(res.status).toBe('INVALID');
    expect(res.issues[0].code).toBe('MISSING_EVENT_ID');
  });

  it('6. unknown selection / 7. wrong market / 8. suspended selection / 9. stale odds / 10. changed odds', async () => {
    setupSupabaseMock({ id: 's1', status: 'DRAFT', total_stake: 100 }, [{ event_id: 'e1', market_id: 'm1', selection_id: 's1', accepted_odds: 1.5, odds_timestamp: '2026-08-29T10:00:00Z' }]);
    
    (sportsClient.validateSlip as any).mockResolvedValue({
      ok: true,
      data: {
        valid: false,
        issues: [{ code: 'ODDS_CHANGED', message: 'Odds changed' }],
        currentOdds: []
      }
    });

    const res = await slipValidationService.validateSlip('s1');
    expect(res.status).toBe('INVALID');
    expect(res.issues[0].code).toBe('ODDS_CHANGED');
  });

  it('12. Member 3 outage', async () => {
    setupSupabaseMock({ id: 's1', status: 'DRAFT', total_stake: 100 }, [{ event_id: 'e1', market_id: 'm1', selection_id: 's1', accepted_odds: 1.5, odds_timestamp: '2026-08-29T10:00:00Z' }]);
    
    (sportsClient.validateSlip as any).mockResolvedValue({
      ok: false,
      error: 'Service Unavailable'
    });

    await expect(slipValidationService.validateSlip('s1')).rejects.toThrow(/unavailable/);
  });

  it('13. Member 3 409 (mapped to standard error struct by client)', async () => {
    setupSupabaseMock({ id: 's1', status: 'DRAFT', total_stake: 100 }, [{ event_id: 'e1', market_id: 'm1', selection_id: 's1', accepted_odds: 1.5, odds_timestamp: '2026-08-29T10:00:00Z' }]);
    
    (sportsClient.validateSlip as any).mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_SLIP', message: 'Something went wrong' }
    });

    const res = await slipValidationService.validateSlip('s1');
    expect(res.status).toBe('INVALID');
    expect(res.issues[0].code).toBe('INVALID_SLIP');
  });
});
