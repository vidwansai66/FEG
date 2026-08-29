import { supabase } from '../config/supabase.js';
import { sportsClient } from '../clients/sportsClient.js';
import { SlipError } from './slipService.js';
import { Decimal } from 'decimal.js';
import { slipStateMachine, SlipStatus } from './slipStateMachine.js';

export interface ValidationIssue {
  code: string;
  message: string;
  details?: any;
}

export class SlipValidationService {
  async validateSlip(slipId: string) {
    // 1. Fetch slip and legs
    const { data: slip, error: slipError } = await supabase
      .from('draft_slips')
      .select('*')
      .eq('id', slipId)
      .single();

    if (slipError || !slip) {
      throw new SlipError('SLIP_NOT_FOUND', 'Draft slip not found', 404);
    }

    if (slip.status !== 'DRAFT') {
      throw new SlipError('INVALID_STATE', `Cannot validate a slip in state: ${slip.status}`, 409);
    }

    const { data: legs, error: legsError } = await supabase
      .from('slip_legs')
      .select('*')
      .eq('draft_slip_id', slipId)
      .order('leg_index', { ascending: true });

    if (legsError || !legs) {
      throw new SlipError('DB_ERROR', 'Failed to fetch slip legs', 500);
    }

    const localIssues: ValidationIssue[] = [];

    // Local validation
    if (slip.total_stake === null || slip.total_stake === undefined || typeof slip.total_stake !== 'number' || isNaN(slip.total_stake) || !isFinite(slip.total_stake) || slip.total_stake < 0) {
      localIssues.push({ code: 'INVALID_STAKE', message: 'Stake must be a finite non-negative number' });
    }

    if (legs.length === 0) {
      localIssues.push({ code: 'NO_LEGS', message: 'Slip has no legs' });
    }

    legs.forEach((leg, idx) => {
      if (!leg.event_id || typeof leg.event_id !== 'string') {
        localIssues.push({ code: 'MISSING_EVENT_ID', message: `Leg ${idx} is missing a canonical event ID` });
      }
      if (!leg.market_id || typeof leg.market_id !== 'string') {
        localIssues.push({ code: 'MISSING_MARKET_ID', message: `Leg ${idx} is missing a canonical market ID` });
      }
      if (!leg.selection_id || typeof leg.selection_id !== 'string') {
        localIssues.push({ code: 'MISSING_SELECTION_ID', message: `Leg ${idx} is missing a canonical selection ID` });
      }
    });

    if (localIssues.length > 0) {
      return this.failValidation(slipId, 'DRAFT', localIssues);
    }

    // 2. Transition to VALIDATING
    await slipStateMachine.transition(slipId, 'DRAFT', 'VALIDATING');

    // 3. Call Member 3
    const validationRequest = {
      legs: legs.map(l => ({
        eventId: l.event_id,
        marketId: l.market_id,
        selectionId: l.selection_id,
        acceptedOdds: l.accepted_odds,
        oddsTimestamp: new Date(l.odds_timestamp).toISOString()
      }))
    };

    const m3Result = await sportsClient.validateSlip(validationRequest);

    if (!m3Result.ok) {
      if (m3Result.error === 'Service Unavailable' || (typeof m3Result.error === 'object' && (m3Result.error as any).code === 'FETCH_ERROR')) {
        // Recover to DRAFT since Member 3 is unavailable. Don't mark INVALID.
        await slipStateMachine.transition(slipId, 'VALIDATING', 'DRAFT');
        throw new SlipError('MEMBER_3_UNAVAILABLE', 'Sports resolution service is unavailable', 503);
      }
      
      // If it's 404 or 409 from Member 3 or other structured error:
      // It's still an invalid slip.
      const errObj = typeof m3Result.error === 'object' ? m3Result.error : { code: 'MEMBER_3_ERROR', message: String(m3Result.error) };
      return this.failValidation(slipId, 'VALIDATING', [errObj as ValidationIssue]);
    }

    const { valid, issues: m3Issues, currentOdds } = m3Result.data!;

    if (!valid || (m3Issues && m3Issues.length > 0)) {
      // Member 3 validation failed
      return this.failValidation(slipId, 'VALIDATING', m3Issues || [{ code: 'UNKNOWN_VALIDATION_ERROR', message: 'Member 3 rejected the slip' }]);
    }

    // 4. Success -> calculate total odds and persist
    let totalOdds = new Decimal(1);
    currentOdds.forEach((odd: any) => {
      totalOdds = totalOdds.times(odd.decimalOdds);
    });

    const totalOddsNum = totalOdds.toNumber();

    try {
      await slipStateMachine.transition(slipId, 'VALIDATING', 'VALIDATED', { total_odds: totalOddsNum });
    } catch (finalizeError) {
      // Best effort recovery
      await slipStateMachine.transition(slipId, 'VALIDATING', 'DRAFT').catch(() => {});
      throw new SlipError('DB_ERROR', 'Failed to save validated state', 500);
    }

    return {
      slipId,
      status: 'VALIDATED',
      totalOdds: totalOddsNum,
      issues: []
    };
  }

  private async failValidation(slipId: string, currentState: SlipStatus, issues: ValidationIssue[]) {
    await slipStateMachine.transition(slipId, currentState, 'INVALID');
    
    return {
      slipId,
      status: 'INVALID',
      totalOdds: null,
      issues
    };
  }
}

export const slipValidationService = new SlipValidationService();
