import { supabase } from '../config/supabase.js';
import { sportsClient } from '../clients/sportsClient.js';
import { SlipError } from './slipService.js';
import { slipStateMachine } from './slipStateMachine.js';

export class SlipConfirmationService {
  async confirmSlip(slipId: string) {
    // 1. Fetch slip and legs
    const { data: slip, error: slipError } = await supabase
      .from('draft_slips')
      .select('*')
      .eq('id', slipId)
      .single();

    if (slipError || !slip) {
      throw new SlipError('SLIP_NOT_FOUND', 'Draft slip not found', 404);
    }

    // Explicit check to safely reject repeated confirmation attempts
    if (slip.status === 'DEMO_CONFIRMED' || slip.status === 'USER_CONFIRMED') {
        throw new SlipError('INVALID_STATE', `Slip is already confirmed (current state: ${slip.status})`, 409);
    }

    // Gate 1: Check status and transition DRAFT -> USER_CONFIRMED is invalid, must be from VALIDATED
    if (slip.status !== 'VALIDATED') {
      throw new SlipError('INVALID_STATE', `Cannot confirm a slip in state: ${slip.status}`, 409);
    }

    // Load legs for Gate 2
    const { data: legs, error: legsError } = await supabase
      .from('slip_legs')
      .select('*')
      .eq('draft_slip_id', slipId)
      .order('leg_index', { ascending: true });

    if (legsError || !legs || legs.length === 0) {
      throw new SlipError('DB_ERROR', 'Failed to fetch slip legs', 500);
    }

    // Perform Gate 1 Transition
    await slipStateMachine.transition(slipId, 'VALIDATED', 'USER_CONFIRMED');

    // Gate 2: Final Member 3 Revalidation
    const validationPayload = {
      legs: legs.map((l: any) => ({
        eventId: l.event_id,
        marketId: l.market_id,
        selectionId: l.selection_id,
        acceptedOdds: l.accepted_odds,
        oddsTimestamp: new Date(l.odds_timestamp).toISOString()
      }))
    };

    const revalidationResult = await sportsClient.validateSlip(validationPayload);

    if (!revalidationResult.ok) {
      if (revalidationResult.status === 503 || revalidationResult.error === 'Service Unavailable' || (typeof revalidationResult.error === 'object' && revalidationResult.error?.code === 'FETCH_ERROR')) {
        throw new SlipError('MEMBER_3_UNAVAILABLE', 'Sports resolution service is unavailable during confirmation', 503);
      }
      // Member 3 validation rejected (ODDS_CHANGED, etc.)
      const errObj = typeof revalidationResult.error === 'object' ? revalidationResult.error : { code: 'MEMBER_3_ERROR', message: String(revalidationResult.error) };
      throw new SlipError('VALIDATION_FAILED', 'Final revalidation failed', 409, [errObj]);
    }

    const { valid, issues } = revalidationResult.data!;

    if (!valid || (issues && issues.length > 0)) {
      throw new SlipError('VALIDATION_FAILED', 'Final revalidation failed', 409, issues || [{ code: 'UNKNOWN_VALIDATION_ERROR', message: 'Member 3 rejected the slip during revalidation' }]);
    }

    // Final Demo Bet Confirmation
    const demoConfirmPayload = {
      slipId: slipId.replace(/-/g, ''), // Member 3 schema does not allow dashes
      legs: legs.map((l: any) => ({
        eventId: l.event_id,
        marketId: l.market_id,
        selectionId: l.selection_id,
        acceptedOdds: l.accepted_odds,
        oddsTimestamp: new Date(l.odds_timestamp).toISOString()
      }))
    };

    const confirmResult = await sportsClient.confirmDemoBet(demoConfirmPayload);

    if (!confirmResult.ok) {
      if (confirmResult.status === 503 || confirmResult.error === 'Service Unavailable' || (typeof confirmResult.error === 'object' && confirmResult.error?.code === 'FETCH_ERROR')) {
        throw new SlipError('CONFIRMATION_OUTCOME_UNKNOWN', 'Confirmation outcome could not be determined. Retry is blocked to prevent duplicate confirmation.', 503);
      }
      // Demo confirmation failed
      const errObj = typeof confirmResult.error === 'object' ? confirmResult.error : { code: 'CONFIRMATION_FAILED', message: String(confirmResult.error) };
      throw new SlipError('CONFIRMATION_FAILED', 'Demo confirmation failed', 409, [errObj]);
    }

    const receiptId = confirmResult.data?.receiptId;

    // Persist DEMO_CONFIRMED and receipt_id
    const extraUpdates: any = {};
    if (receiptId) {
      extraUpdates.receipt_id = receiptId;
    }

    await slipStateMachine.transition(slipId, 'USER_CONFIRMED', 'DEMO_CONFIRMED', extraUpdates);

    return {
      slipId,
      status: 'DEMO_CONFIRMED',
      receiptId
    };
  }
}

export const slipConfirmationService = new SlipConfirmationService();
