import { supabase } from '../config/supabase.js';
import { z } from 'zod';
import { CreateSlipRequest, UpdateSlipRequest } from '../schemas/slips.js';

type CreatePayload = z.infer<typeof CreateSlipRequest>;
type UpdatePayload = z.infer<typeof UpdateSlipRequest>;

export class SlipError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 400, public issues?: any[]) {
    super(message);
  }
}

class SlipService {
  private mapSlip(slip: any, legs: any[]) {
    return {
      id: slip.id,
      sessionId: slip.session_id,
      stake: slip.total_stake,
      status: slip.status,
      receiptId: slip.receipt_id || undefined,
      createdAt: slip.created_at,
      updatedAt: slip.updated_at,
      legs: legs.map(leg => ({
        id: leg.id,
        legIndex: leg.leg_index,
        eventId: leg.event_id,
        marketId: leg.market_id,
        selectionId: leg.selection_id,
        acceptedOdds: leg.accepted_odds,
        oddsTimestamp: leg.odds_timestamp,
        eventLabel: leg.event_label,
        marketLabel: leg.market_label,
        selectionLabel: leg.selection_label
      })).sort((a, b) => a.legIndex - b.legIndex)
    };
  }

  async createSlip(data: CreatePayload) {
    let sessionId = data.sessionId;

    if (sessionId) {
      const { data: session, error } = await supabase.from('sessions').select('id').eq('id', sessionId).single();
      if (error || !session) {
        throw new SlipError('SESSION_NOT_FOUND', 'Session not found', 404);
      }
    } else {
      const { data: newSession, error } = await supabase.from('sessions').insert({ status: 'DRAFT' }).select('id').single();
      if (error || !newSession) {
        throw new SlipError('DB_ERROR', 'Failed to create session', 500);
      }
      sessionId = newSession.id;
    }

    const { data: slip, error: slipError } = await supabase
      .from('draft_slips')
      .insert({ session_id: sessionId, total_stake: data.stake, status: 'DRAFT' })
      .select()
      .single();

    if (slipError || !slip) {
      throw new SlipError('DB_ERROR', 'Failed to create draft slip', 500);
    }

    const legsToInsert = data.legs.map((leg, index) => ({
      draft_slip_id: slip.id,
      leg_index: index,
      event_id: leg.eventId,
      market_id: leg.marketId,
      selection_id: leg.selectionId,
      accepted_odds: leg.acceptedOdds,
      odds_timestamp: leg.oddsTimestamp,
      event_label: leg.eventLabel,
      market_label: leg.marketLabel,
      selection_label: leg.selectionLabel
    }));

    const { data: insertedLegs, error: legsError } = await supabase
      .from('slip_legs')
      .insert(legsToInsert)
      .select();

    if (legsError || !insertedLegs) {
      // NOTE: Transactional limitation - slip was created but legs failed.
      console.warn(`Partial creation: slip ${slip.id} created but legs failed.`);
      throw new SlipError('DB_ERROR', 'Failed to create slip legs', 500);
    }

    return this.mapSlip(slip, insertedLegs);
  }

  async getSlip(id: string) {
    const { data: slip, error: slipError } = await supabase
      .from('draft_slips')
      .select('*')
      .eq('id', id)
      .single();

    if (slipError || !slip) {
      throw new SlipError('SLIP_NOT_FOUND', 'Draft slip not found', 404);
    }

    const { data: legs, error: legsError } = await supabase
      .from('slip_legs')
      .select('*')
      .eq('draft_slip_id', id)
      .order('leg_index', { ascending: true });

    if (legsError) {
      throw new SlipError('DB_ERROR', 'Failed to fetch slip legs', 500);
    }

    return this.mapSlip(slip, legs || []);
  }

  async updateSlip(id: string, data: UpdatePayload) {
    const { data: slip, error: fetchError } = await supabase
      .from('draft_slips')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !slip) {
      throw new SlipError('SLIP_NOT_FOUND', 'Draft slip not found', 404);
    }

    if (slip.status !== 'DRAFT') {
      throw new SlipError('INVALID_STATE', 'Cannot edit a non-DRAFT slip', 409);
    }

    if (data.stake !== undefined) {
      const { error: updateError } = await supabase
        .from('draft_slips')
        .update({ total_stake: data.stake, updated_at: new Date().toISOString() })
        .eq('id', id);
        
      if (updateError) throw new SlipError('DB_ERROR', 'Failed to update slip stake', 500);
    }

    if (data.legs !== undefined) {
      // Replace legs
      const { error: deleteError } = await supabase
        .from('slip_legs')
        .delete()
        .eq('draft_slip_id', id);
        
      if (deleteError) throw new SlipError('DB_ERROR', 'Failed to clear old slip legs', 500);

      const legsToInsert = data.legs.map((leg, index) => ({
        draft_slip_id: id,
        leg_index: index,
        event_id: leg.eventId,
        market_id: leg.marketId,
        selection_id: leg.selectionId,
        accepted_odds: leg.acceptedOdds,
        odds_timestamp: leg.oddsTimestamp,
        event_label: leg.eventLabel,
        market_label: leg.marketLabel,
        selection_label: leg.selectionLabel
      }));

      const { error: insertError } = await supabase
        .from('slip_legs')
        .insert(legsToInsert);
        
      if (insertError) {
        console.warn(`Partial update: slip ${id} legs deleted but replacement failed.`);
        throw new SlipError('DB_ERROR', 'Failed to insert new slip legs', 500);
      }
      
      // Update slip's updated_at if we didn't just update stake
      if (data.stake === undefined) {
          await supabase.from('draft_slips').update({ updated_at: new Date().toISOString() }).eq('id', id);
      }
    }

    return this.getSlip(id);
  }

  async deleteSlip(id: string) {
    const { data: slip, error: fetchError } = await supabase
      .from('draft_slips')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !slip) {
      throw new SlipError('SLIP_NOT_FOUND', 'Draft slip not found', 404);
    }

    if (slip.status !== 'DRAFT') {
      throw new SlipError('INVALID_STATE', 'Cannot delete a non-DRAFT slip', 409);
    }

    const { error: deleteError } = await supabase
      .from('draft_slips')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new SlipError('DB_ERROR', 'Failed to delete slip', 500);
    }

    return { success: true };
  }
}

export const slipService = new SlipService();
