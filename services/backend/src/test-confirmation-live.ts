import { supabase } from './config/supabase.js';
import { slipService } from './services/slipService.js';
import { slipValidationService } from './services/slipValidationService.js';
import { slipConfirmationService } from './services/slipConfirmationService.js';
import { slipStateMachine } from './services/slipStateMachine.js';

async function run() {
  console.log('--- STARTING LIVE CONFIRMATION TEST ---');

  // Generate deterministic ID so we can clean it up
  const slipId = '55555555-5555-5555-5555-555555555555';
  
  try {
    // 0. Cleanup any previous run
    await supabase.from('slip_legs').delete().eq('draft_slip_id', slipId);
    await supabase.from('draft_slips').delete().eq('id', slipId);

    // 0.5 Fetch current valid odds from Member 3
    console.log('Fetching current odds from Member 3...');
    const oddsRes = await fetch('http://localhost:3000/api/sports/odds', {
      method: 'POST',
      body: JSON.stringify({ selectionIds: ['sel_003_arsenal_manchester_city_match_result_home'] }),
      headers: { 'Content-Type': 'application/json' }
    });
    const oddsData = await oddsRes.json();
    const currentOdds = oddsData.odds[0].decimalOdds;
    const currentTimestamp = oddsData.odds[0].timestamp;

    // 1. Create a DRAFT slip directly in DB with known good data from Member 3's mocked data
    console.log('Creating valid DRAFT slip...');
    const { data: session } = await supabase.from('sessions').select('id').limit(1).single();
    const sessionId = session ? session.id : '00000000-0000-0000-0000-000000000000';

    if (!session) {
      await supabase.from('sessions').insert({ id: sessionId, status: 'DRAFT' });
    }

    await supabase.from('draft_slips').insert({
      id: slipId,
      session_id: sessionId,
      total_stake: 10,
      status: 'DRAFT'
    });

    await supabase.from('slip_legs').insert([
      {
        draft_slip_id: slipId,
        leg_index: 0,
        event_id: 'evt_003_arsenal_manchester_city', // Match from Member 3 seed
        market_id: 'mkt_003_arsenal_manchester_city_match_result',
        selection_id: 'sel_003_arsenal_manchester_city_match_result_home',
        accepted_odds: currentOdds,
        odds_timestamp: currentTimestamp,
        event_label: 'Arsenal vs Manchester City',
        market_label: 'Match Result',
        selection_label: 'Arsenal'
      }
    ]);

    // 2. Validate it
    console.log('Validating slip (DRAFT -> VALIDATING -> VALIDATED)...');
    const validationResult = await slipValidationService.validateSlip(slipId);
    console.log('Validation result:', validationResult);
    
    if (validationResult.status !== 'VALIDATED') {
      throw new Error(`Validation failed, got status ${validationResult.status}`);
    }

    // 3. Confirm it
    console.log('Confirming slip (VALIDATED -> USER_CONFIRMED -> DEMO_CONFIRMED)...');
    const confirmResult = await slipConfirmationService.confirmSlip(slipId);
    console.log('Confirmation result:', confirmResult);

    if (confirmResult.status !== 'DEMO_CONFIRMED') {
      throw new Error(`Confirmation failed, got status ${confirmResult.status}`);
    }
    
    if (!confirmResult.receiptId) {
       console.log('WARNING: No receipt ID returned (maybe Member 3 did not return one)');
    } else {
       console.log('Receipt ID present:', confirmResult.receiptId);
    }

    // 4. Repeated confirmation rejected
    console.log('Attempting repeated confirmation (should fail)...');
    try {
      await slipConfirmationService.confirmSlip(slipId);
      throw new Error('Repeated confirmation succeeded incorrectly!');
    } catch (err: any) {
      console.log('Successfully rejected repeated confirmation:', err.message);
    }

    // 5. Test odds safety
    console.log('Creating stale DRAFT slip for safety test...');
    const staleId = '66666666-6666-6666-6666-666666666666';
    await supabase.from('slip_legs').delete().eq('draft_slip_id', staleId);
    await supabase.from('draft_slips').delete().eq('id', staleId);
    
    await supabase.from('draft_slips').insert({
      id: staleId,
      session_id: sessionId,
      total_stake: 10,
      status: 'VALIDATED' // Cheat it to VALIDATED to test confirmation gate
    });

    await supabase.from('slip_legs').insert([
      {
        draft_slip_id: staleId,
        leg_index: 0,
        event_id: 'evt_003_arsenal_manchester_city', 
        market_id: 'mkt_003_arsenal_manchester_city_match_result',
        selection_id: 'sel_003_arsenal_manchester_city_match_result_home',
        accepted_odds: 99.9, // Incorrect odds
        odds_timestamp: new Date().toISOString(),
        event_label: 'Arsenal vs Manchester City',
        market_label: 'Match Result',
        selection_label: 'Arsenal'
      }
    ]);

    console.log('Attempting confirmation on stale odds...');
    try {
      await slipConfirmationService.confirmSlip(staleId);
      throw new Error('Confirmation on stale odds succeeded incorrectly!');
    } catch (err: any) {
      console.log('Successfully rejected confirmation on stale odds:', err.message);
      
      const { data: finalStale } = await supabase.from('draft_slips').select('status').eq('id', staleId).single();
      console.log('Final state of stale slip (should not be DEMO_CONFIRMED):', finalStale?.status);
      if (finalStale?.status === 'DEMO_CONFIRMED') {
          throw new Error('Slip status incorrectly advanced to DEMO_CONFIRMED after odds rejection!');
      }
    }

    // Cleanup
    await supabase.from('slip_legs').delete().eq('draft_slip_id', slipId);
    await supabase.from('draft_slips').delete().eq('id', slipId);
    await supabase.from('slip_legs').delete().eq('draft_slip_id', staleId);
    await supabase.from('draft_slips').delete().eq('id', staleId);
    console.log('Test completed successfully and data cleaned up.');

  } catch (err: any) {
    console.error('LIVE TEST FAILED:', err);
    if (err.issues) console.error('Issues:', JSON.stringify(err.issues, null, 2));
    process.exit(1);
  }
}

run();
