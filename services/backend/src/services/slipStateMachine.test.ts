import { describe, it, expect, vi, beforeEach } from 'vitest';
import { slipStateMachine } from './slipStateMachine.js';
import { supabase } from '../config/supabase.js';

vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('SlipStateMachine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupSupabaseMock = (success: boolean, currentStatus: string | null = null, transitionTo: string | null = null) => {
    const updateSelect = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue(
        success ? { data: { status: transitionTo }, error: null } : { data: null, error: null }
      )
    });
    const chainableUpdateEq: any = vi.fn().mockImplementation(() => ({
      eq: chainableUpdateEq,
      select: updateSelect
    }));
    const update = vi.fn().mockReturnValue({ eq: chainableUpdateEq });

    const selectSingle = vi.fn().mockResolvedValue({
      data: currentStatus ? { status: currentStatus } : null,
      error: null
    });
    const selectEq = vi.fn().mockReturnValue({ maybeSingle: selectSingle });
    const select = vi.fn().mockReturnValue({ eq: selectEq });

    (supabase.from as any).mockImplementation(() => ({
      update,
      select
    }));
  };

  it('1. DRAFT -> VALIDATING', async () => {
    setupSupabaseMock(true, 'DRAFT', 'VALIDATING');
    const result = await slipStateMachine.transition('s1', 'DRAFT', 'VALIDATING');
    expect(result).toBe('VALIDATING');
  });

  it('2. VALIDATING -> VALIDATED', async () => {
    setupSupabaseMock(true, 'VALIDATING', 'VALIDATED');
    const result = await slipStateMachine.transition('s1', 'VALIDATING', 'VALIDATED');
    expect(result).toBe('VALIDATED');
  });

  it('3. VALIDATING -> INVALID', async () => {
    setupSupabaseMock(true, 'VALIDATING', 'INVALID');
    const result = await slipStateMachine.transition('s1', 'VALIDATING', 'INVALID');
    expect(result).toBe('INVALID');
  });

  it('4. DRAFT -> INVALID', async () => {
    setupSupabaseMock(true, 'DRAFT', 'INVALID');
    const result = await slipStateMachine.transition('s1', 'DRAFT', 'INVALID');
    expect(result).toBe('INVALID');
  });

  it('5. DRAFT -> EXPIRED', async () => {
    setupSupabaseMock(true, 'DRAFT', 'EXPIRED');
    const result = await slipStateMachine.transition('s1', 'DRAFT', 'EXPIRED');
    expect(result).toBe('EXPIRED');
  });

  it('6. VALIDATED -> USER_CONFIRMED', async () => {
    setupSupabaseMock(true, 'VALIDATED', 'USER_CONFIRMED');
    const result = await slipStateMachine.transition('s1', 'VALIDATED', 'USER_CONFIRMED');
    expect(result).toBe('USER_CONFIRMED');
  });

  it('7. VALIDATED -> EXPIRED', async () => {
    setupSupabaseMock(true, 'VALIDATED', 'EXPIRED');
    const result = await slipStateMachine.transition('s1', 'VALIDATED', 'EXPIRED');
    expect(result).toBe('EXPIRED');
  });

  it('8. USER_CONFIRMED -> DEMO_CONFIRMED', async () => {
    setupSupabaseMock(true, 'USER_CONFIRMED', 'DEMO_CONFIRMED');
    const result = await slipStateMachine.transition('s1', 'USER_CONFIRMED', 'DEMO_CONFIRMED');
    expect(result).toBe('DEMO_CONFIRMED');
  });

  describe('Illegal Transitions Rejected', () => {
    const testRejection = async (from: any, to: any, caseNumber: number) => {
      it(`${caseNumber}. ${from} -> ${to}`, async () => {
        await expect(slipStateMachine.transition('s1', from, to)).rejects.toThrow(/Cannot transition slip/);
      });
    };

    testRejection('DRAFT', 'VALIDATED', 9);
    testRejection('DRAFT', 'USER_CONFIRMED', 10);
    testRejection('DRAFT', 'DEMO_CONFIRMED', 11);
    testRejection('VALIDATING', 'USER_CONFIRMED', 12);
    testRejection('VALIDATING', 'DEMO_CONFIRMED', 13);
    testRejection('INVALID', 'VALIDATED', 14);
    testRejection('INVALID', 'USER_CONFIRMED', 15);
    testRejection('INVALID', 'DEMO_CONFIRMED', 16);
    testRejection('EXPIRED', 'DRAFT', 17);
    testRejection('EXPIRED', 'VALIDATED', 18);
    testRejection('EXPIRED', 'USER_CONFIRMED', 19);
    testRejection('DEMO_CONFIRMED', 'VALIDATED', 20);
    testRejection('USER_CONFIRMED', 'DRAFT', 21);
  });

  describe('Concurrency & Safety', () => {
    it('throws INVALID_STATE_TRANSITION on race condition (expected VALIDATED but found INVALID)', async () => {
      setupSupabaseMock(false, 'INVALID'); // Mock: the update affected 0 rows, and when we fetched it was INVALID
      await expect(slipStateMachine.transition('s1', 'VALIDATED', 'USER_CONFIRMED')).rejects.toThrow(/Cannot transition slip from INVALID to USER_CONFIRMED/);
    });
  });

  describe('Expiration logic', () => {
    it('identifies expired time correctly', () => {
      const now = new Date('2026-08-29T10:15:00Z');
      const updatedAt = '2026-08-29T10:00:00Z'; // 15 mins old
      expect(slipStateMachine.isExpired(updatedAt, now, 15 * 60 * 1000 - 1)).toBe(true);
      expect(slipStateMachine.isExpired(updatedAt, now, 15 * 60 * 1000)).toBe(false);
    });
  });
});
