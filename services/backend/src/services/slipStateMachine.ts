import { supabase } from '../config/supabase.js';
import { SlipError } from './slipService.js';

export type SlipStatus = 
  | 'DRAFT'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'USER_CONFIRMED'
  | 'DEMO_CONFIRMED'
  | 'INVALID'
  | 'EXPIRED';

const legalTransitions: Record<SlipStatus, SlipStatus[]> = {
  DRAFT: ['VALIDATING', 'INVALID', 'EXPIRED'],
  VALIDATING: ['VALIDATED', 'INVALID', 'DRAFT'], // DRAFT allowed for 503 outage rollback
  VALIDATED: ['USER_CONFIRMED', 'EXPIRED'],
  USER_CONFIRMED: ['DEMO_CONFIRMED'],
  DEMO_CONFIRMED: [],
  INVALID: [],
  EXPIRED: []
};

export class SlipStateMachine {
  canTransition(from: SlipStatus, to: SlipStatus): boolean {
    return legalTransitions[from].includes(to);
  }

  assertTransition(from: SlipStatus, to: SlipStatus): void {
    if (!this.canTransition(from, to)) {
      throw new SlipError(
        'INVALID_STATE_TRANSITION',
        `Cannot transition slip from ${from} to ${to}`,
        409
      );
    }
  }

  isExpired(updatedAt: string, now: Date = new Date(), maxAgeMs: number = 15 * 60 * 1000): boolean {
    const updatedTime = new Date(updatedAt).getTime();
    if (isNaN(updatedTime)) return true; // Invalid date counts as expired
    return now.getTime() - updatedTime > maxAgeMs;
  }

  async transition(slipId: string, from: SlipStatus, to: SlipStatus, extraUpdates: Record<string, any> = {}): Promise<SlipStatus> {
    this.assertTransition(from, to);

    const updatePayload = {
      ...extraUpdates,
      status: to,
      updated_at: new Date().toISOString()
    };

    // Use conditional update to prevent race conditions
    const { data, error } = await supabase
      .from('draft_slips')
      .update(updatePayload)
      .eq('id', slipId)
      .eq('status', from)
      .select('status')
      .maybeSingle();

    if (error) {
      throw new SlipError('DB_ERROR', 'Database error during state transition', 500);
    }

    if (!data) {
      // The slip either doesn't exist, or it is no longer in the expected `from` state due to a race.
      const { data: currentSlip } = await supabase
        .from('draft_slips')
        .select('status')
        .eq('id', slipId)
        .maybeSingle();

      if (!currentSlip) {
        throw new SlipError('SLIP_NOT_FOUND', 'Draft slip not found during transition', 404);
      }

      if (currentSlip.status !== from) {
        throw new SlipError(
          'INVALID_STATE_TRANSITION',
          `Cannot transition slip from ${currentSlip.status} to ${to}`, // Same wording as error
          409
        );
      }
      
      throw new SlipError('DB_ERROR', 'Transition failed unexpectedly despite correct state', 500);
    }

    return data.status as SlipStatus;
  }
}

export const slipStateMachine = new SlipStateMachine();
